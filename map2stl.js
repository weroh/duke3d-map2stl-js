"use strict";

let sectorInfo=[];//static sect_t *sec;
let map2stl_output;

function new_sect_t() { // typedef struct { float z[2]; point2d grad[2]; wall_t *wall; long n; } sect_t;
	return { 
		z: [0, 0], 
		grad: [
			{x:0, y:0, slope: 0},
			{x:0, y:0, slope: 0}
		],
		wall: [],
		wallcount:0
	};
}

function remove_duplicates(arr) {
	return arr.filter((c, index) => {
		return arr.indexOf(c) === index;
	});
}

/*
 * sect2trap()
 * Slices sectors into trapezoids which can then be split into triangles. 
 * Ken Silverman wrote the original C code just for exporting triangles.
 * This is not how Build does it, but it is one way to extract geometry.
 */
function sect2trap(wal) { // static long sect2trap (wall_t *wal, long n, zoid_t **retzoids, long *retnzoids)
	let sector_y = [], trapx0 = [], trapx1 = [];
	let pwal = [];

	let zoids = []; // Empty array
	if (wal.length < 3) return(0);

	// malloc here because this is traversed backwards
	//sector_y.length = wal.length;
	for (let i=0;i<wal.length;i++) {
		sector_y.push(0);
		trapx0.push(0);
		trapx1.push(0);
		pwal.push({});
	}

	// Copy values from wall[i].y
	for(let i=wal.length-1;i>=0;i--) sector_y[i] = wal[i].y;

	// Remove duplicates
	sector_y = remove_duplicates(sector_y);

	// Then sort from low to high
	sector_y.sort(function(a , b) {
		if(a > b) return 1;
		if(a < b) return -1;
		return 0;
	});

	let j = 0;
	for(let s=0;s<sector_y.length-1;s++) {
		let sy0 = sector_y[s];
		let sy1 = sector_y[s+1];
		let ntrap = 0;
		for(let i=0;i<wal.length;i++) {
			// First wall
			let x0 = wal[i].x;
			let y0 = wal[i].y; 
			
			j = wal[i].n+i; // next wall + i
			
			// Second wall
			let x1 = wal[j].x;
			let y1 = wal[j].y;
			if (y0 > y1) {
				// Swap x0,y0 with x1,y1
				let f = x0;
				x0 = x1;
				x1 = f;

				f = y0;
				y0 = y1;
				y1 = f;
			}
			if ((y0 >= sy1) || (y1 <= sy0)) continue;
			if (y0 < sy0) x0 = (sy0-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
			if (y1 > sy1) x1 = (sy1-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
			
			trapx0[ntrap] = x0;
			trapx1[ntrap] = x1;
			pwal[ntrap] = wal[i];
			ntrap++;
		}

		for(let g=(ntrap>>1);g;g>>=1) {
			for(let i=0;i<ntrap-g;i++) {
				for(j=i;j>=0;j-=g) {
					if (trapx0[j]+trapx1[j] <= trapx0[j+g]+trapx1[j+g]) break;
					let f = trapx0[j]; trapx0[j] = trapx0[j+g]; trapx0[j+g] = f;
					f = trapx1[j]; trapx1[j] = trapx1[j+g]; trapx1[j+g] = f;
					let k =   pwal[j];   pwal[j] =   pwal[j+g];   pwal[j+g] = k;
				}
			}
		}

		for(let i=0;i<ntrap;i=j+1) {
			j = i+1;
			if ((trapx0[i+1] <= trapx0[i]) && (trapx1[i+1] <= trapx1[i])) continue;
			while ((j+2 < ntrap) && (trapx0[j+1] <= trapx0[j]) && (trapx1[j+1] <= trapx1[j])) j += 2;

			// Add to the zoids that we're returning
			zoids.push({
				x: [trapx0[i], trapx0[j], trapx1[j], trapx1[i]],
				y: [sy0, sy1]
			});
		}
	}

	return zoids;
}

function getslopez(sector, floorOrCeil, x, y) { // static float getslopez (sect_t *s, long i, float x, float y)
	let wal = sector.wall;
	return((wal[0].x-x)*sector.grad[floorOrCeil].x + (wal[0].y-y)*sector.grad[floorOrCeil].y + sector.z[floorOrCeil]);
}

/*
function getPortalWalls(sectorNum, wallInd) { // static long getwalls (long s, long w, vertlist_t *ver, long maxverts)
	let sectorWalls = sectorInfo[sectorNum].wall; 
	let nextSector = sectorWalls[wallInd].neighborSector;
	let verts = [];

	// -1 means there are no neighboring sectors
	if (nextSector != -1) {
		verts.push({
			s: sectorWalls[wallInd].neighborSector,
			w: sectorWalls[wallInd].neighborWall
		});
	}
	return verts;
}
*/

function swap_vals(v1, v2) {
	let tv = v1;
	v1 = v2;
	v2 = tv;
}

function copy_vec3(vec3) {
	return {
		x: vec3.x,
		y: vec3.y,
		z: vec3.z
	};
}
// Gets point where two slopes intersect. Also maybe should be called lerp_vec3()
function intersect_vec3(v1, v0, lerp) { // lerp = value in between 0 and 1
	return {
		x: (v1.x-v0.x)*lerp + v0.x,
		y: (v1.y-v0.y)*lerp + v0.y,
		z: (v1.z-v0.z)*lerp + v0.z
	};
}

// Looks like this clips along the Z axis in order to creates walls. Removed .n values since they don't do anything.
function wallclip(pol) { // static long wallclip (kgln_t *pol, kgln_t *npol)

	let npol = [];

	// Height difference is used to determine where the wall clips.
	// No difference, no wall. Negative difference, no wall (because it's in the world).
	let dz0 = pol[3].z-pol[0].z; // This wall
	let dz1 = pol[2].z-pol[1].z; // Next wall

	if (dz0 > 0.0) { //do not include null case for rendering
		if (dz1 > 0.0)  { //do not include null case for rendering
			npol.push(copy_vec3(pol[0])); //npol[0] = pol[0];
			npol.push(copy_vec3(pol[1])); //npol[1] = pol[1];
			npol.push(copy_vec3(pol[2])); //npol[2] = pol[2];
			npol.push(copy_vec3(pol[3])); //npol[3] = pol[3];
			return npol;
		}
		else {
			let lerp = dz0/(dz0-dz1);
			npol.push(copy_vec3(pol[0])); //npol[0] = pol[0];
			npol.push(intersect_vec3(pol[1], pol[0], lerp));
			npol.push(copy_vec3(pol[3])); //npol[2] = pol[3];
			return npol;
		}
	}
	else if (dz1 > 0.0) { //do not include null case for rendering
		let lerp = dz0/(dz0-dz1);
		npol.push(intersect_vec3(pol[1], pol[0], lerp));
		npol.push(copy_vec3(pol[1])); //npol[1] = pol[1];
		npol.push(copy_vec3(pol[2])); //npol[2] = pol[2];
		return npol;
	}

	// Clip. Do not include
	return npol;
}

function normal_from_tri(tri) { // tri = array[3] of {x,y,z}
	var result = {x:0, y:0, z:0};

	result.x = (tri[1].y-tri[0].y)*(tri[2].z-tri[0].z) - (tri[1].z-tri[0].z)*(tri[2].y-tri[0].y);
	result.y = (tri[1].z-tri[0].z)*(tri[2].x-tri[0].x) - (tri[1].x-tri[0].x)*(tri[2].z-tri[0].z);
	result.z = (tri[1].x-tri[0].x)*(tri[2].y-tri[0].y) - (tri[1].y-tri[0].y)*(tri[2].x-tri[0].x);

	let f = result.x*result.x + result.y*result.y + result.z*result.z;
	if (f > 0) f = -1/Math.sqrt(f);

	result.x *= f;
	result.y *= f;
	result.z *= f; 

	return result;
}

/*
 * saveasstl()
 * This function appears to take the stuff we have loaded from loadmap() and convert it into "Simple Triangle Soup"
 * This is where all the action is
 */
function saveasstl() {
	const MAXVERTS = 256;

	//#define MAXVERTS 256 //WARNING:not dynamic

	// pol,npol= typedef struct { float x, y, z; int n; } kgln_t;
	let pol = [
		{x:0, y:0, z:0},
		{x:0, y:0, z:0},
		{x:0, y:0, z:0},
		{x:0, y:0, z:0}
	];

	// Output Geometry
	let tri = [
		{x:0, y:0, z:0},
		{x:0, y:0, z:0},
		{x:0, y:0, z:0}
	];

	let normal = {x:0, y:0, z:0};
	let f;

	// This is our intermediate format before converting to obj or whatever
	map2stl_output = [];

	// Two for loops nested in this for loop. One for creating ceilings/floors. The second for creating walls.
	for(let s=0; s<dukemap.map.numsects; s++) {

		let wall = sectorInfo[s].wall;
		let firstWall = wall[0]; // Slopes are aligned to wall[0]
		let n = sectorInfo[s].wallcount;

		// NOTE: This is done slightly differently than in map2stl.c
		// We return nzoids here because it's easy. We're also not expecting memory to fail. So we aren't even checking for that anymore.
		// Also in this version sect2trap only gets called once for both the floor and the ceiling
		let zoids = sect2trap(wall);

		//draw sector filled - Ceilings and Floors first
		//is_floor=0; // CEILING
		//is_floor=1; // FLOOR
		for(let is_floor=0; is_floor<=1; is_floor++) {
			let fz = sectorInfo[s].z[is_floor];
			let grad = sectorInfo[s].grad[is_floor];

			// parallaxing = skybox. SKIP
			if (is_floor == 0 && dukemap.map.sectors[s].ceilingstat_.parallaxing == true) continue;
			if (is_floor == 1 && dukemap.map.sectors[s].floorstat_.parallaxing == true) continue;

			for(let i=0; i<zoids.length; i++) {
				let polInd=0;
				for(let j=0; j<4; j++) {
					pol[polInd].x = zoids[i].x[j];
					pol[polInd].y = zoids[i].y[j>>1];

					if ((polInd == 0) || (pol[polInd].x != pol[polInd-1].x) || (pol[polInd].y != pol[polInd-1].y)) {
						pol[polInd].z = (firstWall.x-pol[polInd].x)*grad.x + (firstWall.y-pol[polInd].y)*grad.y + fz;
						polInd++;
					}
				}
				if (polInd < 3) continue;

				tri[0].x = pol[0].x;
				tri[0].y = pol[0].y;
				tri[0].z = pol[0].z;

				for(let j=2;j<polInd;j++) {
					let k1 = j-is_floor;
					tri[1].x = pol[k1].x;
					tri[1].y = pol[k1].y;
					tri[1].z = pol[k1].z;

					let k2 = (j-1)+is_floor;
					tri[2].x = pol[k2].x;
					tri[2].y = pol[k2].y;
					tri[2].z = pol[k2].z;

					normal = normal_from_tri(tri);

					write_map2stl_output({
						type: (is_floor == 1) ? "floor" : "ceil",
						normal: normal,
						tri: [
							tri[2], tri[1], tri[0]
						],
						sector: s,
						originalIndex: s // original index in the .MAP file
					});
				}
			}
		}

		/*
		for(let w=0; w<sectorInfo[s].wallcount; w++) {
			let cur_wall = wall[w];
			let next_wall = wall[w+cur_wall.n];
			let sector = sectorInfo[s];

			if (typeof cur_wall.skip !== "undefined") continue;

			if (cur_wall.nw == -1) { // -1 = no next wall
				let tri1 = [
					{
						x: cur_wall.x,
						y: cur_wall.y,
						z: getslopez(sector,0,cur_wall.x,cur_wall.y)//sector.z[0]
					},
					{
						x: cur_wall.x,
						y: cur_wall.y,
						z: getslopez(sector,1,cur_wall.x,cur_wall.y)//sector.z[1]
					},
					{
						x: next_wall.x,
						y: next_wall.y,
						z: getslopez(sector,0,next_wall.x,next_wall.y)//sector.z[0]
					}
				];
				let tri2 = [
					{
						x: cur_wall.x,
						y: cur_wall.y,
						z: getslopez(sector,1,cur_wall.x,cur_wall.y)//sector.z[1]
					},
					{
						x: next_wall.x,
						y: next_wall.y,
						z: getslopez(sector,1,next_wall.x,next_wall.y)//sector.z[1]
					},
					{
						x: next_wall.x,
						y: next_wall.y,
						z: getslopez(sector,0,next_wall.x,next_wall.y)//sector.z[0]
					}
				];
				let normal = normal_from_tri(tri1);
				write_map2stl_output({
					type: "wall",
					normal: normal,
					tri: tri1,
					wall: wall[w],
					sector: s,
					originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
				});
				write_map2stl_output({
					type: "wall",
					normal: normal,
					tri: tri2,
					wall: wall[w],
					sector: s,
					originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
				});
			}
			else {
				// Find the neighboring sector/wall
				let nbr_sector = sectorInfo[cur_wall.neighborSector];
				let nbr_wall = nbr_sector.wall[cur_wall.nw];

				nbr_sector.wall[cur_wall.nw].skip = true;
				if (nbr_sector.z[0] != sector.z[0]) { // ceiling height different

					let cw_z = getslopez(sector,0,cur_wall.x,cur_wall.y);
					let nw_z = getslopez(sector,0,next_wall.x,next_wall.y);

					let tri1 = [
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(sector,0,cur_wall.x,cur_wall.y)//sector.z[0]
						},
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(nbr_sector,0,cur_wall.x,cur_wall.y)//nbr_sector.z[0]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(sector,0,next_wall.x,next_wall.y)//sector.z[0]
						}
					];
					let tri2 = [
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(nbr_sector,0,cur_wall.x,cur_wall.y)//nbr_sector.z[0]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(nbr_sector,0,next_wall.x,next_wall.y)//nbr_sector.z[0]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(sector,0,next_wall.x,next_wall.y)//sector.z[0]
						}
					];
					let normal = normal_from_tri(tri1);
					write_map2stl_output({
						type: "wall",
						normal: normal,
						tri: tri1,
						wall: nbr_wall,
						sector: s,
						originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
					});
					write_map2stl_output({
						type: "wall",
						normal: normal,
						tri: tri2,
						wall: nbr_wall,
						sector: s,
						originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
					});
				}


				if (nbr_sector.z[1] != sector.z[1]) { // floor height different

					let tri1 = [
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(nbr_sector,1,cur_wall.x,cur_wall.y)//nbr_sector.z[1]
						},
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(sector,1,cur_wall.x,cur_wall.y)//sector.z[1]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(nbr_sector,1,next_wall.x,next_wall.y)//nbr_sector.z[1]
						}
					];
					let tri2 = [
						{
							x: cur_wall.x,
							y: cur_wall.y,
							z: getslopez(sector,1,cur_wall.x,cur_wall.y)//sector.z[1]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(sector,1,next_wall.x,next_wall.y)//sector.z[1]
						},
						{
							x: next_wall.x,
							y: next_wall.y,
							z: getslopez(nbr_sector,1,next_wall.x,next_wall.y)//nbr_sector.z[1]
						}
					];
					let normal = normal_from_tri(tri1);
					write_map2stl_output({
						type: "wall",
						normal: normal,
						tri: tri1,
						wall: wall[w],
						sector: s,
						originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
					});
					write_map2stl_output({
						type: "wall",
						normal: normal,
						tri: tri2,
						wall: wall[w],
						sector: s,
						originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
					});
				}
			}
		}
		*/

		// Draw Walls
		for(let w=0; w<sectorInfo[s].wallcount; w++) {
			let nextWall = wall[w].n+w;

			//let verts = getPortalWalls(s,w);
			let vn = 0;

			pol[0].x = wall[ w].x; pol[0].y = wall[ w].y;
			pol[1].x = wall[nextWall].x; pol[1].y = wall[nextWall].y;
			pol[2].x = wall[nextWall].x; pol[2].y = wall[nextWall].y;
			pol[3].x = wall[ w].x; pol[3].y = wall[ w].y;

			if (wall[w].neighborSector != -1) {
				vn = 1;
			}

			for(let k=0;k<=vn;k++) { //Warning: do not reverse for loop!
				let s0;
				let s1;
				let cf0;
				let cf1;

				if (wall[w].neighborSector != -1) { // Has neighbor wall
					if (k == 0) {
						s0 = s; // Cur Sector
						s1 = wall[w].neighborSector; // Next sector
						cf0 = 0; // Ceiling
						cf1 = 0; // Ceiling

						// Check for skybox...
						let tsec = dukemap.map.sectors[s];
						let nsec = dukemap.map.sectors[wall[w].neighborSector];
						if (tsec.ceilingstat_.parallaxing && nsec.ceilingstat_.parallaxing) continue;
					}
					else {
						s0 = wall[w].neighborSector; // Next sector
						s1 = s; // Cur Sector
						cf0 = 1; // Floor
						cf1 = 1; // Floor

						// Check for skybox...
						let tsec = dukemap.map.sectors[s];
						let nsec = dukemap.map.sectors[wall[w].neighborSector];
						if (tsec.floorstat_.parallaxing && nsec.floorstat_.parallaxing) continue;
					}
				}
				else { // Build wall from top to bottom
					s0 = s; // Cur Sector
					s1 = s; // Cur Sector
					cf0 = 0; // Ceiling
					cf1 = 1; // Floor
				}

				// Z positions (aka height) will determine where the wall clips
				pol[0].z = getslopez(sectorInfo[s0],cf0,pol[0].x,pol[0].y);
				pol[1].z = getslopez(sectorInfo[s0],cf0,pol[1].x,pol[1].y);
				pol[2].z = getslopez(sectorInfo[s1],cf1,pol[2].x,pol[2].y);
				pol[3].z = getslopez(sectorInfo[s1],cf1,pol[3].x,pol[3].y);

				// Now clip based on Z
				let npol = wallclip(pol);
				if (npol.length == 0) continue;

				// Finalized triangles come from npol starting with #0
				tri[0] = copy_vec3(npol[0]);

				for(let j=1;j<npol.length-1;j++) {
					tri[1] = copy_vec3(npol[j]);
					tri[2] = copy_vec3(npol[j+1]);
					
					normal = normal_from_tri(tri);

					write_map2stl_output({
						j: j,
						npol: npol,
						type: "wall",
						normal: normal,
						tri: [
							{
								x: npol[j+1].x,
								y: npol[j+1].y,
								z: npol[j+1].z
							},
							{
								x: npol[j].x,
								y: npol[j].y,
								z: npol[j].z,
							},
							{
								x: npol[0].x,
								y: npol[0].y,
								z: npol[0].z,
							}
						],
						wall: wall[w],
						sector: s,
						originalIndex: wall[w].orig.wallIndex // Original index in the .MAP file
					});
				}
			}
		}
	}
}

/*
 * write_map2stl_output()
 * Since JavaScript will pass a lot of these things by reference, it is important that we explicitly copy everything
 * That's all this function is doing. Copying variables into the map2stl_output variable.
 */
function write_map2stl_output(params) {
	var result = {
		type: params.type,
		normal: new THREE.Vector3(),
		tri: [
			new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
		],
		wall: params.wall,
		originalIndex: params.originalIndex,

		j: params.j,
		npol: params.npol
	};
	if (typeof params.sector !== "undefined") {
		result.sector = params.sector;
	}
	result.normal.copy(params.normal);
	result.tri[0].copy(params.tri[0]);
	result.tri[1].copy(params.tri[1]);
	result.tri[2].copy(params.tri[2]);

	map2stl_output.push(result);
}

/*
 * loadmap()
 * In the original version of map2stl, all the loading happened here
 * In the JS version, we did most of our loading in our more general purpose dukemap.js
 * This function is now designed to take the data extrated from dukemap and format it for
 * use with map2stl
 */
function loadmap() {
	// Copy relevant sector info and walls to sectorInfo[]
	sectorInfo = [];

	// By now we've pulled data using dukemap.js
	// This converts sectors from the dukemap format to our map2stl format so we can process them in the saveasstl() function
	for (let i=0;i<dukemap.map.sectors.length;i++) {
		let b7sec = dukemap.map.sectors[i];

		// Create new sectorInfo
		sectorInfo.push(new_sect_t());
		sectorInfo[i].sectorIndex = i;
		sectorInfo[i].orig = b7sec;
		sectorInfo[i].wallcount = b7sec.wallnum;

		if (b7sec.lotag == 2) { // Water
			sectorInfo[i].isWater = true;
		}
		else {
			sectorInfo[i].isWater = false;
		}

		// Floor Z position
		sectorInfo[i].z[0] = (b7sec.ceilingz / 16);
		sectorInfo[i].z[1] = (b7sec.floorz / 16);

		// Convert slopes from 8192 to 90 degrees. Max 32767
		if (b7sec.ceilingstat&2) { //&2 = Enable slopes flag
			sectorInfo[i].grad[0].slope = b7sec.ceilingheinum*(1/4096); // 4096 = 45 degrees. 0 = flat
		}
		if (b7sec.floorstat&2) { //&2 = Enable slopes flag
			sectorInfo[i].grad[1].slope = b7sec.floorheinum*(1/4096); // 4096 = 45 degrees. 0 = flat
		}
	}

	let wallIndex = 0;
	for(let i=0;i<dukemap.map.numsects;i++) {
		for(let j=0;j<sectorInfo[i].wallcount;j++,wallIndex++) {
			let startpos = dukemap.map.sectors[i].wallptr;
			let b7wal = dukemap.map.walls[wallIndex];
			b7wal.wallIndex = wallIndex;
			sectorInfo[i].wall.push({
				x: b7wal.x,
				y: b7wal.y,
				n: b7wal.point2-wallIndex,

				// Added orig so we can extract wall textures and other attributes later...
				orig: b7wal
			});
		}

		let fx = sectorInfo[i].wall[1].y-sectorInfo[i].wall[0].y;
		let fy = sectorInfo[i].wall[0].x-sectorInfo[i].wall[1].x;
		let f = fx*fx + fy*fy;

		if (f > 0) {
			f = 1/Math.sqrt(f);
		}

		fx *= f;
		fy *= f;
		
		for(let j=0;j<2;j++) {
			sectorInfo[i].grad[j].x = fx*sectorInfo[i].grad[j].slope;
			sectorInfo[i].grad[j].y = fy*sectorInfo[i].grad[j].slope;
		}
	}
	return true;
}

function checknextwalls() {
	let $goto = false;

	//Clear all nextsect/nextwalls
	for(let s0=0;s0<dukemap.map.numsects;s0++) {
		for(let w0=0;w0<sectorInfo[s0].wallcount;w0++)  {
			sectorInfo[s0].wall[w0].neighborSector = sectorInfo[s0].wall[w0].neighborWall = -1;
		}
	}

	for(let s1=1;s1<dukemap.map.numsects;s1++) {
		for(let w1=0;w1<sectorInfo[s1].wallcount;w1++) {
			let x0 = sectorInfo[s1].wall[w1].x;
			let y0 = sectorInfo[s1].wall[w1].y;

			let nextWall = sectorInfo[s1].wall[w1].n+w1;

			//console.log(s1, nextWall,sectorInfo[s1].wall[nextWall]);
			let x1 = sectorInfo[s1].wall[nextWall].x;
			let y1 = sectorInfo[s1].wall[nextWall].y;


			// This next step checks for walls that are right next to each other.
			// This data is already saved in the map, but for some reason we're scanning through this anyway

			$goto = false; // Little hack to simulate goto
			for(let s0=0;s0<s1;s0++) {
				for(let w0=0;w0<sectorInfo[s0].wallcount;w0++) {
					if ((sectorInfo[s0].wall[w0].x == sectorInfo[s1].wall[nextWall].x) && (sectorInfo[s0].wall[w0].y == sectorInfo[s1].wall[nextWall].y)) {
						
						let w0n = sectorInfo[s0].wall[w0].n+w0;

						if ((sectorInfo[s0].wall[w0n].x == sectorInfo[s1].wall[w1].x) && (sectorInfo[s0].wall[w0n].y == sectorInfo[s1].wall[w1].y)) {
							sectorInfo[s1].wall[w1].neighborSector = s0;
							sectorInfo[s1].wall[w1].neighborWall = w0;
							sectorInfo[s0].wall[w0].neighborSector = s1;
							sectorInfo[s0].wall[w0].neighborWall = w1;
							$goto = true;
						}
					}
					if ($goto) { break; }
				}
				if ($goto) { break; }
			}
			//cnw_break2:;
		}
	}
}