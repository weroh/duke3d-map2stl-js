<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title></title>
</head>
<body style="background: #000;color:#fff">
	<script src="jquery.min.js"></script>

	<script src="dukemap.js"></script>

	<ul>
		<?php
		$files = scandir(__DIR__ . '/map/');
		foreach ($files as $filename) {
			$pi = pathinfo($filename);

			if (isset($pi['extension']) && strtolower($pi['extension']) == 'map') {
				echo '<li class="loadmap"><a href="#" data-filename="' . $filename . '">' . $filename . '</a></li>';
			}
		}
		?>
	</ul>

	<p id="coord" style="color:#fff;font-family:'courier new'"></p>
	<canvas id="myCanvas" width="1200" height="800"></canvas>


	<script>
		var canvas = document.getElementById("myCanvas");
		var ctx = canvas.getContext("2d");
		var coord = document.getElementById("coord");
		var dukemap;

		let isMovingView = false;
		let GridSize = 32;
		let lastMouseX = 0;
		let lastMouseY = 0;
		let CameraX = 0;
		let CameraY = 0;
		let MapScale = 1;

		let CameraZoom = -40;
		let ZoomFactors = [
			1/128,
			1/64,
			1/32,
			1/16,
			1/8,
			1/4,
			1/2,
			1, // normal
			2,
			3,
			4,
			5,
			6
		];
		function transMouseCoords(x, y) {
			return {
				x: (x / MapScale) - (CameraX),
				y: (y / MapScale) - (CameraY)
			};
		}
		function transX(x) {
			return (x * MapScale) + (CameraX * MapScale) + canvas.width / 2;
		}
		function transY(y) {
			return (y * MapScale) + (CameraY * MapScale) + canvas.height / 2;
		}
		function setZoom(zoom) {
			CameraZoom = zoom;
			if (CameraZoom > 0) {
				MapScale = CameraZoom;
			}
			else if (CameraZoom == 0) {
				MapScale = 1;
			}
			else if (CameraZoom < 0) {
				MapScale = 1 / -CameraZoom;
			}			
		}

		function startEvents() {
			// event.offsetX, event.offsetY gives the (x,y) offset from the edge of the canvas.

			// Add the event listeners for mousedown, mousemove, and mouseup
			canvas.addEventListener('mousedown', e => {
				var x = e.offsetX;
				var y = e.offsetY;

				isMovingView = true;

				lastMouseX = x;
				lastMouseY = y;
			});

			canvas.addEventListener("onwheel" in document ? "wheel" : "mousewheel", function(e) {
				e.preventDefault();
				if (e.deltaY > 0) {
					CameraZoom -= 1;
				}
				else if (e.deltaY < 0) {
					CameraZoom += 1;
				}

				if (CameraZoom < -100) {
					CameraZoom = -100;
				}
				if (CameraZoom > 100) {
					CameraZoom = 100
				}


				setZoom(CameraZoom);
				redrawMap();
			});

			canvas.addEventListener('mousemove', e => {
				var x = e.offsetX;
				var y = e.offsetY;

				var tc1 = transMouseCoords(lastMouseX, lastMouseY);
				var tc2 = transMouseCoords(x, y);
				if (isMovingView) {
					CameraX -= tc1.x - tc2.x;
					CameraY -= tc1.y - tc2.y;
					redrawMap();
				}

				coord.innerHTML = tc1.x + ", " + tc1.y;

				lastMouseX = x;
				lastMouseY = y;
			});

			canvas.addEventListener('mouseup', e => {
				isMovingView = false;
			});

			document.addEventListener('keydown', e => {
				e = e || window.event;

				if (e.keyCode == '38') {
					// up arrow
					CameraY += 512;
					e.preventDefault();
					redrawMap();
				}
				else if (e.keyCode == '40') {
					// down arrow
					CameraY -= 512;
					e.preventDefault();
					redrawMap();
				}
				else if (e.keyCode == '37') {
				   // left arrow
				   CameraX += 512;
				   e.preventDefault();
				   redrawMap();
				}
				else if (e.keyCode == '39') {
				   // right arrow
				   CameraX -= 512;
				   e.preventDefault();
				   redrawMap();
				}
			});
		}
		function drawGrid(context) {
			// Draw lines for new_sector
			setColor("grey");
			var t0 = transMouseCoords(0,0);
			var t1 = transMouseCoords(canvas.width,canvas.height);

			context.lineWidth = 1;

			// Offset the grid based on 0,0
			var offX = -(t0.x % GridSize);
			var offY = -(t0.y % GridSize);
			for (var x=t0.x+offX; x<t1.x;x+=GridSize) {
				context.beginPath();
				context.moveTo(transX(x), 0);
				context.lineTo(transX(x), canvas.height);
				context.stroke();
				context.closePath();
			}
			for (var y=t0.y+offY; y<t1.y;y+=GridSize) {
				context.beginPath();
				context.moveTo(0, transY(y));
				context.lineTo(canvas.width, transY(y));
				context.stroke();
				context.closePath();
			}
		}
		function clearMap() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
		function redrawMap() {

			if (typeof dukemap === "undefined") {
				return;
			}
			if (typeof dukemap.map === "undefined") {
				return;
			}

			//console.log([MapScale, CameraX, CameraY]);


			drawGrid(ctx);

			setColor("#ffffff");

			var map = dukemap.map;

			clearMap();

			//console.log(map);
			//console.log("numsects: " + map.numsects);
			//map.numsects = 4;
			for (s=0;s<map.numsects;s++) {
				drawSector(s);
			}
			//map.sectors[60].color = '#ffffff';
			//drawSector(map.sectors[60]);
		}
		function setColor(color) {
			ctx.strokeStyle = color;
		}
		function drawWall(w1, w2) {
			ctx.beginPath();
			ctx.moveTo(transX(dukemap.map.walls[w1].x), transY(dukemap.map.walls[w1].y));
			ctx.lineTo(transX(dukemap.map.walls[w2].x), transY(dukemap.map.walls[w2].y));
			ctx.stroke();
			ctx.closePath();
		}
		function drawSector(sectorNum) {
			var sector = dukemap.map.sectors[sectorNum];

			setColor(sector.color);

			var startpos = sector.wallptr;

			// Move to first wall
			for (var i=0;i<sector.wallnum;i++) {
				var w = startpos + i;
				var nextw = dukemap.map.walls[w].point2;
				//ctx.moveTo(transX(dukemap.map.walls[w].x), transY(dukemap.map.walls[w].y));
				//ctx.lineTo(transX(dukemap.map.walls[nextw].x), transY(dukemap.map.walls[nextw].y));

				drawWall(w, nextw);
			}
		}

		setZoom(CameraZoom);
		startEvents();
		$("li.loadmap a").on("click", function(e) {
			e.preventDefault();
			var filename = $(this).attr("data-filename");

			dukemap = Object.create(DukeMap);
			dukemap.loadURL("map/" + filename);
			dukemap.onLoad = function() {
				CameraX = -dukemap.map.playerStart.x;
				CameraY = -dukemap.map.playerStart.y;

				for (var i=0;i<dukemap.map.sectors.length;i++) {
					dukemap.map.sectors[i].color = "#" + Math.floor(Math.random()*16777215).toString(16);
				}

				redrawMap();
			};
		});
			
	</script>
</body>
</html>