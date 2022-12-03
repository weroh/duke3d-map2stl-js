"use strict";

let sectorInfo=[];//static sect_t *sec;
let b7sec;
let b7wal;
let map2stl_output;

function new_point3d() { // typedef struct { float x, y, z; } point3d;
  return { x:0, y:0, z:0 };
}

function new_point2d() { // typedef struct { float x, y; } point2d;
  return { x:0, y:0 };
}

function new_wall_t() { // typedef struct { float x, y; long n, ns, nw; } wall_t;
	return {
		x: 0, y: 0, n: 0, ns: 0, nw: 0
	};
}

function new_sect_t() { // typedef struct { float z[2]; point2d grad[2]; wall_t *wall; long n; } sect_t;
	return { 
		z: [0, 0], 
		grad: [new_point2d(), new_point2d()],
		wall: [],
		wallcount:0
	};
}

function new_kgln_t() { // typedef struct { float x, y, z; int n; } kgln_t;
	return { x: 0, y: 0, z: 0, n: 0 };
}

function new_zoid_t() { //typedef struct { float x[4], y[2]; long pwal[2]; } zoid_t;
	return {
		x: [0, 0, 0, 0],
		y: [0, 0],
		pwal: [{}, {}] // Pointer in C++, but object here in JavaScript
	};
}

function remove_duplicates(arr) {
	return arr.filter((c, index) => {
		return arr.indexOf(c) === index;
	});
}

/*
 * sect2trap()
 * Not 100% sure what this does, but I believe it is converting sectors to trapezoids based on the name.
 * It seems to be mainly used for filling roof + ceiling
 */
function sect2trap(wal, n, zoids) { // static long sect2trap (wall_t *wal, long n, zoid_t **retzoids, long *retnzoids)
	let sector_y = [], trapx0 = [], trapx1 = [];
	let pwal = [];

	zoids.length = 0; // Empty array
	if (n < 3) return(0);

	// malloc here because this is traversed backwards
	sector_y.length = n;
	for (let i=0;i<n;i++) {
		sector_y.push(0);
		trapx0.push(0);
		trapx1.push(0);
		pwal.push({});
	}

	// Copy values from wall[i].y
	for(let i=n-1;i>=0;i--) sector_y[i] = wal[i].y;

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
		for(let i=0;i<n;i++) {
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
				y: [sy0, sy1],
				pwal: [pwal[i], pwal[j]]
			});
		}
	}

	// NOTE: This used to return true/false. False if we ran out of memory. 20 years later, that shouldn't happen anymore.
	// It's important to return the true total because zoids isn't truncated. Maybe in a future optimization we'll truncate zoids[].
	return zoids.length;
}

function getslopez(s, i, x, y) { // static float getslopez (sect_t *s, long i, float x, float y)
	let wal = s.wall;
	return((wal[0].x-x)*s.grad[i].x + (wal[0].y-y)*s.grad[i].y + s.z[i]);
}

function getwalls(s, w, verts, maxverts) { // static long getwalls (long s, long w, vertlist_t *ver, long maxverts)
	let wal = sectorInfo[s].wall; 
	let nextSector = wal[w].ns;

	// -1 means there are no neighboring sectors
	if (nextSector <= -1) return(0);

	var limit = 250; // This limit prevents the do while loop from running away. We shouldn't have 250 walls in one sector anyway...

	// Now lets get a list of walls directly next to other sectors. This is important for carving out hallways or portals into another sector
	let vn = 0; 
	let nw = wal[w].n+w; 
	let bw = wal[w].nw;
	do {
		let wal2 = sectorInfo[nextSector].wall; 
		let i = wal2[bw].n+bw; //Make sure it's an opposite wall
		if ((wal[w].x == wal2[i].x) && (wal[nw].x == wal2[bw].x) &&
			  (wal[w].y == wal2[i].y) && (wal[nw].y == wal2[bw].y)) {
			if (vn < maxverts) {
				verts[vn].s = nextSector;
				verts[vn].w = bw;
				vn++;
			}
		}
		nextSector = wal2[bw].ns;
		bw = wal2[bw].nw;

		if (--limit <= 0) { break; }
	} while (nextSector != s);

	//Sort next sects by order of height in middle of wall (crap sort)
	let fx = (wal[w].x+wal[nw].x)*0.5;
	let fy = (wal[w].y+wal[nw].y)*0.5;
	for(let k=1;k<vn;k++) {
		for(let j=0;j<k;j++) {
			console.log(k,j);
			if (getslopez(sectorInfo[verts[j].s],0,fx,fy) + getslopez(sectorInfo[verts[j].s],1,fx,fy) >
				  getslopez(sectorInfo[verts[k].s],0,fx,fy) + getslopez(sectorInfo[verts[k].s],1,fx,fy)) {
				let tver = verts[j];
				verts[j] = verts[k];
				verts[k] = tver;
			}
		}
	}
	return(vn);
}

function copy_kgln_t(k1, k2) {
	k1.x = k2.x;
	k1.y = k2.y;
	k1.z = k2.z;
	k1.n = k2.n;
}
function wallclip(pol, npol) { // static long wallclip (kgln_t *pol, kgln_t *npol)
	let dz0 = pol[3].z-pol[0].z;
  let dz1 = pol[2].z-pol[1].z;

	if (dz0 > 0.0) { //do not include null case for rendering
		if (dz1 > 0.0)  { //do not include null case for rendering
			copy_kgln_t(npol[0], pol[0]); //npol[0] = pol[0];
			copy_kgln_t(npol[1], pol[1]); //npol[1] = pol[1];
			copy_kgln_t(npol[2], pol[2]); //npol[2] = pol[2];
			copy_kgln_t(npol[3], pol[3]); //npol[3] = pol[3];
			npol[0].n = npol[1].n = npol[2].n = 1;
			npol[3].n = -3;
			return(4);
		}
		else {
			let f = dz0/(dz0-dz1);
			copy_kgln_t(npol[0], pol[0]); //npol[0] = pol[0];
			npol[1].x = (pol[1].x-pol[0].x)*f + pol[0].x;
			npol[1].y = (pol[1].y-pol[0].y)*f + pol[0].y;
			npol[1].z = (pol[1].z-pol[0].z)*f + pol[0].z;
			copy_kgln_t(npol[2], pol[3]); //npol[2] = pol[3];
			npol[0].n = npol[1].n = 1;
			npol[2].n = -2;
			return(3);
		}
	}
	if (dz1 > 0.0) { //do not include null case for rendering
		let f = dz0/(dz0-dz1);
		npol[0].x = (pol[1].x-pol[0].x)*f + pol[0].x;
		npol[0].y = (pol[1].y-pol[0].y)*f + pol[0].y;
		npol[0].z = (pol[1].z-pol[0].z)*f + pol[0].z;
		copy_kgln_t(npol[1], pol[1]); //npol[1] = pol[1];
		copy_kgln_t(npol[2], pol[2]); //npol[2] = pol[2];
		npol[0].n = npol[1].n = 1;
		npol[2].n = -2;
		return(3);
	}

	// Clip
	return (0);
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
	let verts = [];
	for (let i=0;i<MAXVERTS;i++) {
		verts.push({w:0, s:0});
	}

  // pol,npol= typedef struct { float x, y, z; int n; } kgln_t;
	let pol = [new_kgln_t(), new_kgln_t(), new_kgln_t(), new_kgln_t()];
  let npol = [new_kgln_t(), new_kgln_t(), new_kgln_t(), new_kgln_t()]; 

  // Output Geometry
	let tri = [new_point3d(),new_point3d(),new_point3d()], normal = new_point3d();
	let zoids = [];
	let f;

	// This is our intermediate format before converting to obj or whatever
	map2stl_output = [];

	// Two for loops nested in this for loop. One for creating ceilings/floors. The second for creating walls.
	for(let s=0; s<dukemap.map.numsects; s++) {

		let wall = sectorInfo[s].wall;
		let n = sectorInfo[s].wallcount;

		// NOTE: This is done slightly differently than in map2stl.c
		// We return nzoids here because it's easy. We're also not expecting memory to fail. So we aren't even checking for that anymore.
		// Also in this version sect2trap only gets called once for both the floor and the ceiling
		let nzoids = sect2trap(wall,n,zoids);
		console.log(nzoids);

		//draw sector filled - Ceilings and Floors first
		//is_floor=0; // CEILING
		//is_floor=1; // FLOOR
		for(let is_floor=0; is_floor<=1; is_floor++) {
			let fz = sectorInfo[s].z[is_floor];
			let grad = sectorInfo[s].grad[is_floor];

			for(let i=0; i<nzoids; i++) {
        n=0;
				for(let j=0; j<4; j++) {
					pol[n].x = zoids[i].x[j];
					pol[n].y = zoids[i].y[j>>1];

					if ((!n) || (pol[n].x != pol[n-1].x) || (pol[n].y != pol[n-1].y)) {
						pol[n].z = (wall[0].x-pol[n].x)*grad.x + (wall[0].y-pol[n].y)*grad.y + fz;
						pol[n].n = 1; n++;
					}
				}
				if (n < 3) continue;
				pol[n-1].n = 1-n;

				tri[0].x = pol[0].x;
				tri[0].y = pol[0].y;
				tri[0].z = pol[0].z;

				for(let j=2;j<n;j++) {
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

		// Draw Walls
		//wall = sectorInfo[s].wall; 
		let wn = sectorInfo[s].wallcount; // wn=numer of walls
		for(let w=0; w<wn; w++) {
			let nw = wall[w].n+w;
			let vn = getwalls(s,w,verts,MAXVERTS);


			pol[0].x = wall[ w].x; pol[0].y = wall[ w].y; pol[0].n = 1;
			pol[1].x = wall[nw].x; pol[1].y = wall[nw].y; pol[1].n = 1;
			pol[2].x = wall[nw].x; pol[2].y = wall[nw].y; pol[2].n = 1;
			pol[3].x = wall[ w].x; pol[3].y = wall[ w].y; pol[3].n =-3;

			for(let k=0;k<=vn;k++) { //Warning: do not reverse for loop!
				let s0 = 0;
				let s1 = 0;
				let cf0 = 0;
				let cf1 = 0;
				if (k >  0) { s0 = verts[k-1].s; cf0 = 1; } else { s0 = s; cf0 = 0; }
				if (k < vn) { s1 = verts[k  ].s; cf1 = 0; } else { s1 = s; cf1 = 1; }

				pol[0].z = getslopez(sectorInfo[s0],cf0,pol[0].x,pol[0].y);
				pol[1].z = getslopez(sectorInfo[s0],cf0,pol[1].x,pol[1].y);
				pol[2].z = getslopez(sectorInfo[s1],cf1,pol[2].x,pol[2].y);
				pol[3].z = getslopez(sectorInfo[s1],cf1,pol[3].x,pol[3].y);
				i = wallclip(pol, npol); if (!i) continue;

				tri[0].x = npol[0].x;
				tri[0].y = npol[0].y;
				tri[0].z = npol[0].z;

				for(let j=2;j<i;j++) {
					tri[1].x = npol[j-1].x; tri[1].y = npol[j-1].y; tri[1].z = npol[j-1].z;
					tri[2].x = npol[j  ].x; tri[2].y = npol[j  ].y; tri[2].z = npol[j  ].z;
					
          normal = normal_from_tri(tri);

					write_map2stl_output({
						j: j,
						npol: npol,
						type: "wall",
						normal: normal,
						tri: [
							{
								x: npol[j  ].x,
								y: npol[j  ].y,
								z: npol[j  ].z
							},
							{
								x: npol[j-1].x,
								y: npol[j-1].y,
								z: npol[j-1].z,
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
		sectorInfo[i].wallcount = b7sec.wallnum;

		sectorInfo[i].z[0] = (b7sec.ceilingz / 16);
		sectorInfo[i].z[1] = (b7sec.floorz / 16);

		//Enable slopes flag
		if (b7sec.ceilingstat&2) { //Enable slopes flag
			sectorInfo[i].grad[0].y = b7sec.ceilingheinum*(1/4096);
		}
		if (b7sec.floorstat&2) { //Enable slopes flag
			sectorInfo[i].grad[1].y = b7sec.floorheinum*(1/4096);
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
		if (f > 0) f = 1/Math.sqrt(f); fx *= f;
		fy *= f;
		for(let j=0;j<2;j++) {
			sectorInfo[i].grad[j].x = fx*sectorInfo[i].grad[j].y;
			sectorInfo[i].grad[j].y = fy*sectorInfo[i].grad[j].y;
		}
	}
	return true;
}

function checknextwalls() {
	let $goto = false;

	//Clear all nextsect/nextwalls
	for(let s0=0;s0<dukemap.map.numsects;s0++) {
		for(let w0=0;w0<sectorInfo[s0].wallcount;w0++)  {
			sectorInfo[s0].wall[w0].ns = sectorInfo[s0].wall[w0].nw = -1;
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
							sectorInfo[s1].wall[w1].ns = s0;
							sectorInfo[s1].wall[w1].nw = w0;
							sectorInfo[s0].wall[w0].ns = s1;
							sectorInfo[s0].wall[w0].nw = w1;
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