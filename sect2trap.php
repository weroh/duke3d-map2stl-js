<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title></title>
</head>
<body style="background: #000;color:#fff">
	<script src="jquery.min.js"></script>

	<p id="coord" style="color:#fff;font-family:'courier new'"></p>
	<canvas id="myCanvas" width="800" height="500"></canvas><br>
	<button id="drawAll">Draw All Zoids</button>
	<button id="drawNext">Draw Next</button>
	<button id="drawPrev">Draw Previous</button>

	<script>
		var canvas = document.getElementById("myCanvas");
		var ctx = canvas.getContext("2d");
		var coord = document.getElementById("coord");

		/*
		var poly = [
			{x: 29184, y: 36352},
			{x: 28416, y: 35584},
			{x: 27904, y: 35072},
			{x: 27648, y: 34304},
			{x: 27904, y: 33536},
			{x: 28160, y: 32512},
			{x: 28416, y: 32000},
			{x: 29696, y: 31232},
			{x: 32000, y: 29440},
			{x: 34048, y: 29696},
			{x: 35072, y: 29952},
			{x: 36096, y: 31232},
			{x: 36352, y: 32768},
			{x: 36608, y: 34560},
			{x: 39424, y: 34816},
			{x: 40448, y: 36352},
			{x: 39680, y: 38656},
			{x: 35072, y: 39424},
			{x: 33536, y: 38400},
			{x: 32000, y: 38144},
		];
		*/
		var poly = [
			{ x: -768, y: -2560, n: 1 },
			{ x: 512, y: -3072, n: 1 },
			{ x: 1536, y: -1536, n: 1 },
			{ x: 4096, y: -1536, n: 1 },
			{ x: 5120, y: 0, n: 1 },
			{ x: 4608, y: 1024, n: 1 },
			{ x: 4096, y: 2304, n: 1 },
			{ x: 3584, y: 3328, n: 1 },
			{ x: 1792, y: 4352, n: 1 },
			{ x: 0, y: 4352, n: 1 },
			{ x: -1280, y: 4608, n: 1 },
			{ x: -2304, y: 3072, n: 1 },
			{ x: -2816, y: 2304, n: 1 },
			{ x: -3584, y: 2304, n: 1 },
			{ x: -4352, y: 1536, n: 1 },
			{ x: -3328, y: -1280, n: 1 },
			{ x: -2304, y: -3072, n: -16 },
			{ x: -768, y: -1024, n: 1 },
			{ x: -1536, y: 768, n: 1 },
			{ x: 1280, y: 2304, n: 1 },
			{ x: 2304, y: 1280, n: 1 },
			{ x: 2048, y: 256, n: -4 },
		];


		/*
		// Find next wall
		let k = 0;
		for (let i=0;i<poly.length;i++) {
			if (i+1 >= poly.length) {
				n = -(poly.length - 1);
			}
			else {
				n = 1;
			}
			poly[i].n = n;
		}
		*/

		drawPoly(poly);

		let CameraZoom = -40;
		function clearMap() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
		function setColor(color) {
			ctx.strokeStyle = color;
		}
		function setRandomColor() {
			setColor("#" + Math.floor(Math.random()*16777215).toString(16));
		}
		function transX(x) {
			return (x + 6000) / 20;
		}
		function transY(y) {
			return (y + 4000) / 20;
		}
		function drawWall(w1, w2) {
			ctx.beginPath();
			ctx.moveTo(transX(w1.x), transY(w1.y));
			ctx.lineTo(transX(w2.x), transY(w2.y));

			//console.log(transX(w1.x), transY(w1.y), transX(w2.x), transY(w2.y));

			ctx.stroke();
			ctx.closePath();
		}
		function drawPoly(sectorNum) {
			setColor('#ffffff');

			// n = next point
			for (let i=0;i<poly.length;i++) {
				var p1 = {x: poly[i + 0].x, y: poly[i + 0].y};
				var n = poly[i].n;
				var p2 = {x: poly[i + n].x, y: poly[i + n].y};
				drawWall(p1, p2);
			}
		}
		
		let zoids = [];
		let nzoids = sect2trap(poly, poly.length, zoids);

		console.log(zoids);
		function sect2trap(wal, n, zoids) {
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
					if ((y0 >= sy1) || (y1 <= sy0)) {continue;}

					// Get X of this line relative to the Y coordinate
					if (y0 < sy0) x0 = (sy0-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
					if (y1 > sy1) x1 = (sy1-wal[i].y)*(wal[j].x-wal[i].x)/(wal[j].y-wal[i].y) + wal[i].x;
					
					trapx0[ntrap] = x0;
					trapx1[ntrap] = x1;
					pwal[ntrap] = wal[i];
					ntrap++;
				}

				//console.log("for(let g=(ntrap>>1);g;g>>=1) {");
				for(let g=(ntrap>>1);g;g>>=1) {
					//console.log("  for(let i=0;i<ntrap-g;i++) {");
					for(let i=0;i<ntrap-g;i++) {
						//console.log("    for(j=i;j>=0;j-=g) {");
						for(j=i;j>=0;j-=g) {
							if (trapx0[j]+trapx1[j] <= trapx0[j+g]+trapx1[j+g]) break;
							let f = trapx0[j]; trapx0[j] = trapx0[j+g]; trapx0[j+g] = f;
							f = trapx1[j]; trapx1[j] = trapx1[j+g]; trapx1[j+g] = f;
							let k =   pwal[j];   pwal[j] =   pwal[j+g];   pwal[j+g] = k;

							//console.log(trapx0, trapx1);
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
		function remove_duplicates(arr) {
			return arr.filter((c, index) => {
				return arr.indexOf(c) === index;
			});
		}


		// pol,npol= typedef struct { float x, y, z; int n; } kgln_t;
		let pol = [{x:0,y:0,n:0}, {x:0,y:0,n:0}, {x:0,y:0,n:0}, {x:0,y:0,n:0}];
		let npol = [{x:0,y:0,n:0}, {x:0,y:0,n:0}, {x:0,y:0,n:0}, {x:0,y:0,n:0}]; 


		let tri = [{x:0, y:0},{x:0, y:0},{x:0, y:0}];

		let zoidInd = 0;

		function drawAllZoids() {
			for(let zoidInd=0; zoidInd<nzoids; zoidInd++) 
			{
				drawZoid(zoidInd);
			}
			zoidInd = 0;
		}

		function drawZoid(zoidInd) {
			n=0;
			if (typeof zoids[zoidInd] === "undefined") {return;}
			for(let j=0; j<4; j++) {
				pol[n].x = zoids[zoidInd].x[j];
				pol[n].y = zoids[zoidInd].y[j>>1];

				//console.log(n, !n);

				if ((n == 0) || (pol[n].x != pol[n-1].x) || (pol[n].y != pol[n-1].y)) {
					pol[n].n = 1; n++;
				}
			}
			if (n >= 3) {
				pol[n-1].n = 1-n;

				tri[0].x = pol[0].x;
				tri[0].y = pol[0].y;

				setRandomColor();

				for(let j=2;j<n;j++) {
					let k1 = j;
					tri[1].x = pol[k1].x;
					tri[1].y = pol[k1].y;

					let k2 = (j-1);
					tri[2].x = pol[k2].x;
					tri[2].y = pol[k2].y;

					drawWall(tri[0], tri[1]);
					drawWall(tri[1], tri[2]);
					drawWall(tri[2], tri[0]);
				}
			}
		}

		$("#drawAll").on("click", function(e) {
			e.preventDefault();
			clearMap();
			drawAllZoids();
		});
		$("#drawNext").on("click", function(e) {
			e.preventDefault();

			zoidInd++;
			if (zoidInd > nzoids) {
				zoidInd = nzoids;
			}

			clearMap();
			drawZoid(zoidInd);
		});
		$("#drawPrev").on("click", function(e) {
			e.preventDefault();

			zoidInd--;
			if (zoidInd < 0) {
				zoidInd = 0;
			}

			clearMap();
			drawZoid(zoidInd);
		});
	</script>

</body>
</html>

