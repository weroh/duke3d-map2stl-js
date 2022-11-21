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
		n:0
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

var numsects=0;
var sectorInfo=[];//static sect_t *sec;
var b7sec;
var b7wal;
var map2stl_output;


// Quickly sort integers
function shell_sort(a, n) { // static void shellsrt (float *a, long n)
	var t=0;//float t;
	var i=0, j=0, g=0;//long i, j, g;

	for(g=(a.length>>1);g;g>>=1) {
		for(i=0;i<a.length-g;i++) {
			for(j=i;(j>=0)&&(a[j]>a[j+g]);j-=g) { 
				t = a[j];
				a[j] = a[j+g];
				a[j+g] = t;
			}
    }
  }
}
/*
 * sect2trap()
 * Not 100% sure what this does, but I believe it is converting sectors to trapezoids based on the name.
 * It seems to be mainly used for filling roof + ceiling
 */
//typedef struct { float x[4], y[2]; long pwal[2]; } zoid_t;
function sect2trap(wal, n, zoids) { // static long sect2trap (wall_t *wal, long n, zoid_t **retzoids, long *retnzoids)
	//float f, x0, y0, x1, y1, sy0, sy1, cury, *secy = 0, *trapx0 = 0, *trapx1 = 0;
	//long i, j, k, g, s, secn, ntrap, tot, zoidalloc, *pwal = 0;

	var f, x0, y0, x1, y1, sy0, sy1, cury, secy = [], trapx0 = [], trapx1 = [];
	var i, j, k, g, s, secn, ntrap, tot, pwal = [];

	zoids.length = 0; // Empty array
	if (n < 3) return(0);

	// malloc here because this is traversed backwards
	for (i=0;i<n;i++) {
		secy.push(0);
		trapx0.push(0);
		trapx1.push(0);
		pwal.push({});
	}

	// Sort through these values and then...
	for(i=n-1;i>=0;i--) secy[i] = wal[i].y;
	shell_sort(secy,n);

	// Remove duplicates? 
	// NOTE: This doesn't seem to actually remove duplicates. Just uses secn to truncate it in the next loop
	for(i=0,secn=0,cury=-1e32;i<n;i++) {
		//console.log(secy[i] > cury, secy[i], cury);
		if (secy[i] > cury) {
			secy[secn++] = cury = secy[i];
		}
	}


	// Resize the zoids array by double the amount.
	zoidalloc = secn*2; //just a guess (not guaranteed to fit)
	for (i = 0;i<zoidalloc;i++) {
		zoids.push(new_zoid_t());
	}

	// tot = Used for total "zoids"
	tot = 0;
	for(s=0;s<secn-1;s++)
	{
		sy0 = secy[s]; sy1 = secy[s+1]; ntrap = 0;
		for(i=0;i<n;i++) //FIX:optimize
		{
			x0 = wal[i].x; y0 = wal[i].y; 
      j = wal[i].n+i;
			x1 = wal[j].x; y1 = wal[j].y;
			if (y0 > y1)
			{
				f = x0; x0 = x1; x1 = f;
				f = y0; y0 = y1; y1 = f;
			}
			if ((y0 >= sy1) || (y1 <= sy0)) continue;
			if (y0 < sy0) x0 = (sy0-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
			if (y1 > sy1) x1 = (sy1-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
			
      trapx0[ntrap] = x0;
      trapx1[ntrap] = x1;
      pwal[ntrap] = wal[i];
      ntrap++;
		}
		for(g=(ntrap>>1);g;g>>=1) {
			for(i=0;i<ntrap-g;i++) {
				for(j=i;j>=0;j-=g) {
					if (trapx0[j]+trapx1[j] <= trapx0[j+g]+trapx1[j+g]) break;
					f = trapx0[j]; trapx0[j] = trapx0[j+g]; trapx0[j+g] = f;
					f = trapx1[j]; trapx1[j] = trapx1[j+g]; trapx1[j+g] = f;
					k =   pwal[j];   pwal[j] =   pwal[j+g];   pwal[j+g] = k;
				}
			}
		}

		// Not enough space in zoids[] ? Add more...
		if (tot+ntrap > zoidalloc)
		{
			zoidalloc <<= 1; if (tot+ntrap > zoidalloc) zoidalloc = tot+ntrap;
			//zoids = (zoid_t *)realloc(zoids,zoidalloc*sizeof(zoid_t)); if (!zoids) goto badret;

			// JS Replacement for realloc()
			for (i=zoids.length;i<zoidalloc;i++) {
				zoids.push(new_zoid_t());
			}
		}
		for(i=0;i<ntrap;i=j+1)
		{
			j = i+1; if ((trapx0[i+1] <= trapx0[i]) && (trapx1[i+1] <= trapx1[i])) continue;
			while ((j+2 < ntrap) && (trapx0[j+1] <= trapx0[j]) && (trapx1[j+1] <= trapx1[j])) j += 2;

			// NOTE: This could be optimized using zoids.push() instead of setting by index...
			zoids[tot].x[0] = trapx0[i]; zoids[tot].x[1] = trapx0[j]; zoids[tot].y[0] = sy0;
			zoids[tot].x[3] = trapx1[i]; zoids[tot].x[2] = trapx1[j]; zoids[tot].y[1] = sy1;
			zoids[tot].pwal[0] = pwal[i]; zoids[tot].pwal[1] = pwal[j];
			tot++;
		}
	}

	// NOTE: This used to return true/false. False if we ran out of memory. 20 years later, that shouldn't happen anymore.
	// It's important to return the true total because zoids isn't truncated. Maybe in a future optimization we'll truncate zoids[].
	return tot;
}

function getslopez(s, i, x, y) // static float getslopez (sect_t *s, long i, float x, float y)
{
	var wal = s.wall;
	return((wal[0].x-x)*s.grad[i].x + (wal[0].y-y)*s.grad[i].y + s.z[i]);
}

function getwalls (s, w, ver, maxverts) // static long getwalls (long s, long w, vertlist_t *ver, long maxverts)
{
	//vertlist_t tver;
	//wall_t *wal, *wal2;
	//float fx, fy;
	//long i, j, k, bs, bw, nw, vn;
	var tver;
	var wal, wal2;
	var fx, fy;
	var i, j, k, bs, bw, nw, vn;

	wal = sectorInfo[s].wall; bs = wal[w].ns;

	/*
	Note: The following doesn't translate well in JavaScript
	if ((unsigned)bs >= (unsigned)numsects) return(0);

	casting (unsigned)bs will cause a -1 value to be much greater than numsects causing us to return 0
	It seems negative values require us to eject. And values greater than numsects cause us to return 0
	So we check this as two separate conditions now
	*/
	if (bs >= numsects) return(0);
	if (bs <= -1) return(0);

	vn = 0; nw = wal[w].n+w; bw = wal[w].nw;
	do
	{
		wal2 = sectorInfo[bs].wall; i = wal2[bw].n+bw; //Make sure it's an opposite wall
		if ((wal[w].x == wal2[i].x) && (wal[nw].x == wal2[bw].x) &&
			  (wal[w].y == wal2[i].y) && (wal[nw].y == wal2[bw].y)) {
			if (vn < maxverts) {
				ver[vn].s = bs;
				ver[vn].w = bw;
				vn++;
			}
		}
		bs = wal2[bw].ns;
		bw = wal2[bw].nw;

    console.log(bs, s);
	} while (bs != s);

		//Sort next sects by order of height in middle of wall (crap sort)
	fx = (wal[w].x+wal[nw].x)*0.5;
	fy = (wal[w].y+wal[nw].y)*0.5;
	for(k=1;k<vn;k++) {
		for(j=0;j<k;j++) {
			if (getslopez(sectorInfo[ver[j].s],0,fx,fy) + getslopez(sectorInfo[ver[j].s],1,fx,fy) >
				  getslopez(sectorInfo[ver[k].s],0,fx,fy) + getslopez(sectorInfo[ver[k].s],1,fx,fy)) {
				tver = ver[j];
				ver[j] = ver[k];
				ver[k] = tver;
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
	var f, dz0, dz1;

	dz0 = pol[3].z-pol[0].z;
  dz1 = pol[2].z-pol[1].z;
	if (dz0 > 0.0) //do not include null case for rendering
	{
		//npol[0] = pol[0];
		copy_kgln_t(npol[0], pol[0]);
		if (dz1 > 0.0) //do not include null case for rendering
		{
			copy_kgln_t(npol[1], pol[1]); //npol[1] = pol[1];
			copy_kgln_t(npol[2], pol[2]); //npol[2] = pol[2];
			copy_kgln_t(npol[3], pol[3]); //npol[3] = pol[3];
			npol[0].n = npol[1].n = npol[2].n = 1; npol[3].n = -3;
			return(4);
		}
		else
		{
			f = dz0/(dz0-dz1);
			npol[1].x = (pol[1].x-pol[0].x)*f + pol[0].x;
			npol[1].y = (pol[1].y-pol[0].y)*f + pol[0].y;
			npol[1].z = (pol[1].z-pol[0].z)*f + pol[0].z;
			copy_kgln_t(npol[2], pol[3]); //npol[2] = pol[3];
			npol[0].n = npol[1].n = 1; npol[2].n = -2;
			return(3);
		}
	}
	if (dz1 <= 0.0) { //do not include null case for rendering
		return(0);
	}
	else {
		f = dz0/(dz0-dz1);
		npol[0].x = (pol[1].x-pol[0].x)*f + pol[0].x;
		npol[0].y = (pol[1].y-pol[0].y)*f + pol[0].y;
		npol[0].z = (pol[1].z-pol[0].z)*f + pol[0].z;
		copy_kgln_t(npol[1], pol[1]); //npol[1] = pol[1];
		copy_kgln_t(npol[2], pol[2]); //npol[2] = pol[2];
		npol[0].n = npol[1].n = 1; npol[2].n = -2;
		return(3);
	}
}

function normal_from_tri(tri) { // tri = array[3] of {x,y,z}
	var result = {x:0, y:0, z:0};

  result.x = (tri[1].y-tri[0].y)*(tri[2].z-tri[0].z) - (tri[1].z-tri[0].z)*(tri[2].y-tri[0].y);
  result.y = (tri[1].z-tri[0].z)*(tri[2].x-tri[0].x) - (tri[1].x-tri[0].x)*(tri[2].z-tri[0].z);
  result.z = (tri[1].x-tri[0].x)*(tri[2].y-tri[0].y) - (tri[1].y-tri[0].y)*(tri[2].x-tri[0].x);

	f = result.x*result.x + result.y*result.y + result.z*result.z;
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
	var verts = [];
	for (i=0;i<MAXVERTS;i++) {
		verts.push({w:0, s:0});
	}

  // pol,npol= typedef struct { float x, y, z; int n; } kgln_t;
	var pol = [new_kgln_t(), new_kgln_t(), new_kgln_t(), new_kgln_t()];
  var npol = [new_kgln_t(), new_kgln_t(), new_kgln_t(), new_kgln_t()]; 

  // Output Geometry
	var tri = [new_point3d(),new_point3d(),new_point3d()], normal = new_point3d();
	var grad;
	var wal;
	var zoids = [];
	var fil;
	var f, fz;
	var i=0, j=0, k=0, n=0, w=0, s=0, nw=0, wn=0, vn=0, s0=0, cf0=0, s1=0, cf1=0, isflor=0;
	var numtris;
	var tbuf = [80];

	// This is our intermediate format before converting to obj or whatever
	map2stl_output = [];

	for(s=0;s<numsects;s++) {
		//draw sector filled - Ceilings and Floors first
		//isflor=0; // CEILING
		//isflor=1; // FLOOR
		for(isflor=0;isflor<=1;isflor++) {
			wal = sectorInfo[s].wall; fz = sectorInfo[s].z[isflor]; grad = sectorInfo[s].grad[isflor]; n = sectorInfo[s].n;

			// NOTE: This is done slightly differently than in map2stl.c
			// We return nzoids here because it's easy. We're also not expecting memory to fail. So we aren't even checking for that anymore.
			let nzoids = sect2trap(wal,n,zoids);

			for(i=0; i<nzoids; i++) {
        n=0;
				for(j=0; j<4; j++) {
					pol[n].x = zoids[i].x[j];
					pol[n].y = zoids[i].y[j>>1];
					if ((!n) || (pol[n].x != pol[n-1].x) || (pol[n].y != pol[n-1].y))
					{
						pol[n].z = (wal[0].x-pol[n].x)*grad.x + (wal[0].y-pol[n].y)*grad.y + fz;
						pol[n].n = 1; n++;
					}
				}
				if (n < 3) continue;
				pol[n-1].n = 1-n;

				tri[0].x = pol[0].x; tri[0].y = pol[0].y; tri[0].z = pol[0].z;
				for(j=2;j<n;j++)
				{
					k = j-isflor;   
          tri[1].x = pol[k].x; tri[1].y = pol[k].y; tri[1].z = pol[k].z;

					k = j-1+isflor;
          tri[2].x = pol[k].x; tri[2].y = pol[k].y; tri[2].z = pol[k].z;

          normal = normal_from_tri(tri);

					write_map2stl_output({
						type: (isflor == 1) ? "floor" : "ceil",
						normal: normal,
						tri: [
							tri[2], tri[1], tri[0]
						],
						sec: s,
						wal: w
					});
					numtris++;
				}
			}
		}

		// Draw Walls
		wal = sectorInfo[s].wall; wn = sectorInfo[s].n; // wn=numer of walls
		for(w=0;w<wn;w++)
		{
			nw = wal[w].n+w; vn = getwalls(s,w,verts,MAXVERTS);
			pol[0].x = wal[ w].x; pol[0].y = wal[ w].y; pol[0].n = 1;
			pol[1].x = wal[nw].x; pol[1].y = wal[nw].y; pol[1].n = 1;
			pol[2].x = wal[nw].x; pol[2].y = wal[nw].y; pol[2].n = 1;
			pol[3].x = wal[ w].x; pol[3].y = wal[ w].y; pol[3].n =-3;
			for(k=0;k<=vn;k++) //Warning: do not reverse for loop!
			{
				if (k >  0) { s0 = verts[k-1].s; cf0 = 1; } else { s0 = s; cf0 = 0; }
				if (k < vn) { s1 = verts[k  ].s; cf1 = 0; } else { s1 = s; cf1 = 1; }

				pol[0].z = getslopez(sectorInfo[s0],cf0,pol[0].x,pol[0].y);
				pol[1].z = getslopez(sectorInfo[s0],cf0,pol[1].x,pol[1].y);
				pol[2].z = getslopez(sectorInfo[s1],cf1,pol[2].x,pol[2].y);
				pol[3].z = getslopez(sectorInfo[s1],cf1,pol[3].x,pol[3].y);
				i = wallclip(pol, npol); if (!i) continue;

				tri[0].x = npol[0].x; tri[0].y = npol[0].y; tri[0].z = npol[0].z;
				for(j=2;j<i;j++)
				{
					tri[1].x = npol[j-1].x; tri[1].y = npol[j-1].y; tri[1].z = npol[j-1].z;
					tri[2].x = npol[j  ].x; tri[2].y = npol[j  ].y; tri[2].z = npol[j  ].z;
					
          normal = normal_from_tri(tri);

					write_map2stl_output({
						type: "wall",
						normal: normal,
						tri: [
							tri[2], tri[1], tri[0]
						],
						sec: s,
						wal: wal[w]
					});
					numtris++;
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
		sec: params.sec,
		wal: params.wal
	};
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
	for (var i=0;i<dukemap.map.sectors.length;i++) {
		var b7sec = dukemap.map.sectors[i];

		// Create new sectorInfo
		sectorInfo.push(new_sect_t());
		sectorInfo[i].sectorIndex = i;
		sectorInfo[i].n = b7sec.wallnum;

		sectorInfo[i].z[0] = (b7sec.ceilingz)*(1 / (16));
		sectorInfo[i].z[1] = (b7sec.floorz)*(1 / (16));

		//Enable slopes flag
		if (b7sec.ceilingstat&2) { //Enable slopes flag
			sectorInfo[i].grad[0].y = b7sec.ceilingheinum*(1/4096);
		}
		if (b7sec.floorstat&2) { //Enable slopes flag
			sectorInfo[i].grad[1].y = b7sec.floorheinum*(1/4096);
		}
	}

	numsects = dukemap.map.numsects;
	for(i=k=0;i<numsects;i++) {
		for(j=0;j<sectorInfo[i].n;j++,k++) {
			var startpos = dukemap.map.sectors[i].wallptr;
			var b7wal = dukemap.map.walls[k];
			sectorInfo[i].wall.push({
				x: b7wal.x,
				y: b7wal.y,
				n: b7wal.point2-k,

				// Added orig so we can extract wall textures and other attributes later...
				orig: b7wal
			});
		}

		fx = sectorInfo[i].wall[1].y-sectorInfo[i].wall[0].y;
		fy = sectorInfo[i].wall[0].x-sectorInfo[i].wall[1].x;
		f = fx*fx + fy*fy; if (f > 0) f = 1/Math.sqrt(f); fx *= f; fy *= f;
		for(j=0;j<2;j++)
		{
			sectorInfo[i].grad[j].x = fx*sectorInfo[i].grad[j].y;
			sectorInfo[i].grad[j].y = fy*sectorInfo[i].grad[j].y;
		}
	}
	return true;
}

function checknextwalls() {
	var x0, y0, x1, y1;
	var s0, w0, w0n, s1, w1, w1n;
	var $goto = false;

	//Clear all nextsect/nextwalls
	for(s0=0;s0<numsects;s0++) {
		for(w0=0;w0<sectorInfo[s0].n;w0++)  {
			sectorInfo[s0].wall[w0].ns = sectorInfo[s0].wall[w0].nw = -1;
		}
	}

	for(s1=1;s1<numsects;s1++) {
		for(w1=0;w1<sectorInfo[s1].n;w1++)
		{
			x0 = sectorInfo[s1].wall[w1].x;  y0 = sectorInfo[s1].wall[w1].y; w1n = sectorInfo[s1].wall[w1].n+w1;
			x1 = sectorInfo[s1].wall[w1n].x; y1 = sectorInfo[s1].wall[w1n].y;

			$goto = false; // Little hack to simulate goto
			for(s0=0;s0<s1;s0++) {
				for(w0=0;w0<sectorInfo[s0].n;w0++) {
					if ((sectorInfo[s0].wall[w0].x == x1) && (sectorInfo[s0].wall[w0].y == y1))
					{
						w0n = sectorInfo[s0].wall[w0].n+w0;
						if ((sectorInfo[s0].wall[w0n].x == x0) && (sectorInfo[s0].wall[w0n].y == y0))
						{
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