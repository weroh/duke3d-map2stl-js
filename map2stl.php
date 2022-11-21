<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title></title>
</head>
<body style="background: #ddd;color:#fff">
	<script src="jquery.min.js"></script>

	<ul id="map-list">
		<?php
		$files = scandir('./map/');
		foreach ($files as $filename) {
			$pi = pathinfo($filename);

			if (isset($pi['extension']) && strtolower($pi['extension']) == 'map') {
				echo '<li class="loadmap"><a href="#" data-filename="map/' . $filename . '">' . $filename . '</a></li>';
			}
		}
		?>
	</ul>
	<p style="color:#000;">WASD to move. [Space] = go up. [C] = go down. Use arrow keys to look. [Esc] returns mouse. [Alt] + [Enter] = Full screen. Reload to try new map.</p>
	<script src="dukemap.js"></script>
	<script src="map2stl.js"></script>

	<script src="three/three.min.js"></script>

	<script>

		var scene, renderer, camera;
		var cube;
		var controls;
		var mapLoaded = false;


		init();
		animate();


		$("li.loadmap a").on("click", function(e) {
			e.preventDefault();
			var filename = $(this).attr("data-filename");
			$("#map-list").hide();
			dukemap = Object.create(DukeMap);
			dukemap.loadURL(filename);
			dukemap.onLoad = function() { // void main()

				loadmap();
				checknextwalls();
				saveasstl();

				loadGeometry();

				mapLoaded = true;
			};
		});
		function init()
		{
			scene = new THREE.Scene();
			scene.background = new THREE.Color( 0x222222 );

			renderer = new THREE.WebGLRenderer({antialias:true});
			var width = window.innerWidth;
			var height = window.innerHeight;
			renderer.setSize(width, height);
			document.body.appendChild(renderer.domElement);

			camera = new THREE.PerspectiveCamera(90, width/height, 1, 100000);
			camera.rotation.order = 'YXZ';
			//camera.position.y = 160;
			//camera.position.z = -400;

			// E1L1
			camera.position.x = 9161.288354044362;
			camera.position.y = 160;
			camera.position.z = 45738.39795404206;

			/*
			//test map
			camera.position.x = 1173.0146677060202;
			camera.position.y = 160;
			camera.position.z = -172.18099228472315;
			*/


			camera.lookAt(new THREE.Vector3(0,0,0));

			const useFlyControls = false;
			if (useFlyControls == true) {
				controls = new THREE.FlyControls(camera, renderer.domElement);
				controls.movementSpeed = 1000;
				controls.domElement = renderer.domElement;
				controls.rollSpeed = Math.PI / 5;
				controls.autoForward = false;
				controls.dragToLook = true;		
			}
			else {
				//controls = new THREE.OrbitControls(camera, renderer.domElement);
				controls = {
					update: function() {}
				};
			}

			// For now, all ambient lighting
			const ambientlight = new THREE.AmbientLight(0xffffff);
			scene.add(ambientlight);

			controls.keyStates = {
				'KeyW': false,
				'KeyA': false,
				'KeyS': false,
				'KeyD': false,
			};
			controls.mouseStates = {
				left: false,
				middle: false,
				right: false,
				scroll: 0,
			}
			camera.rotationX = 0;
			camera.rotationY = 0;
		}
		// Converts 16 bit picnum into two 8bit pic nums (255 x 255)
		// format TILES255_255
		function get_tile_name(picnum) {
			var num1 = picnum & 0xFF;
			var num2 = ((picnum >> 8) & 0xFF);

			var tex_file = 'TILES' + ('000'+num2).slice(-3);
			tex_file += "_" + num1;

			return tex_file;
		}

		// Loads from map2stl into threejs
		function loadGeometry() {
			const groups = {};
			const normals = [];
			const verts = [];
			//console.log(map2stl_output);
			for (i=0;i<map2stl_output.length;i++) {
				var item = map2stl_output[i];

				let verts = [];
				var positions = [];
				let temp_normals = [];
				let normals = [];
				let uvs = [];

				var p = convert_vec3d(item.normal);
				//var p = item.normal;
				for (n=0;n<3;n++) {
					normals.push(p.x);
					normals.push(p.y);
					normals.push(p.z);
				}

				for (t=0;t<3;t++) {
					var p = convert_vec3d(item.tri[t]);
					//var p = item.tri[t];
					verts.push(p.x);
					verts.push(p.y);
					verts.push(p.z);
				}

				var surfsector = dukemap.map.sectors[item.sec];
				var picnum = 0;
				var uv_scale_x = 512;
				var uv_scale_y = 512;
				var uv_offset_x = 0;
				var uv_offset_y = 0;
				if (item.type == "wall") {
					picnum = item.wal.orig.picnum;
					//uv_scale_x = (4 * 8192) / item.wal.orig.xrepeat;
					//uv_scale_y = (2 * 8192) / item.wal.orig.yrepeat;

					//uv_offset_x = -item.wal.orig.xpanning;
					//uv_offset_y = -item.wal.orig.ypanning;
					/*
					xyrepeat
					1 = bigger
					8 = smaller

					y = 2* x
					x = 1/2 y

					16 = 512
					8 = 1024
					4 = 2048
					*/
				}
				else if (item.type == "floor") {
					picnum = surfsector.floorpicnum;
				}
				else if (item.type == "ceil") {
					picnum = surfsector.ceilingpicnum;
				}

				//if (Math.abs(item.normal.z) > Math.abs(item.normal.y) && Math.abs(item.normal.z) > Math.abs(item.normal.x)) { // ceiling and floor
				if (item.type == "ceil" || item.type == "floor") {
					uvs.push(item.tri[0].y / uv_scale_x);
					uvs.push(item.tri[0].x / uv_scale_y);
					uvs.push(item.tri[1].y / uv_scale_x);
					uvs.push(item.tri[1].x / uv_scale_y);
					uvs.push(item.tri[2].y / uv_scale_x);
					uvs.push(item.tri[2].x / uv_scale_y);
				}
				else if (Math.abs(item.normal.y) > Math.abs(item.normal.x) && Math.abs(item.normal.y) > Math.abs(item.normal.z)) { // standing wall
					uvs.push((item.tri[0].x  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[0].z / uv_scale_y) + (uv_offset_y / 512));
					uvs.push((item.tri[1].x  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[1].z / uv_scale_y) + (uv_offset_y / 512));
					uvs.push((item.tri[2].x  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[2].z / uv_scale_y) + (uv_offset_y / 512));
				}
				// NOTE: We do greater-than-equals here because it accounts for a 45 degree wall.
				else if (Math.abs(item.normal.x) >= Math.abs(item.normal.y) && Math.abs(item.normal.x) > Math.abs(item.normal.z)) { // standing wall
					uvs.push((item.tri[0].y  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[0].z / uv_scale_y) + (uv_offset_y / 512));
					uvs.push((item.tri[1].y  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[1].z / uv_scale_y) + (uv_offset_y / 512));
					uvs.push((item.tri[2].y  / uv_scale_x) + (uv_offset_x / 512));
					uvs.push((-item.tri[2].z / uv_scale_y) + (uv_offset_y / 512));
				}
				else { // ????
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
				}
				for (const x in verts) {
					positions.push(parseFloat(verts[x]));
				}



				//picnum = dukemap.map.sectors[sectorInd].ceilingpicnum;
				var tex_file = get_tile_name(picnum);
				
				if (typeof groups[tex_file] === "undefined") {
					groups[tex_file] = {
						positions: [],
						normals: [],
						uvs: [],
					};
				}

				groups[tex_file].positions.push(...positions);
				groups[tex_file].normals.push(...normals);
				groups[tex_file].uvs.push(...uvs);
			}

			for (var tex in groups) {

				const geometry = new THREE.BufferGeometry();
				const positionNumComponents = 3;
				const normalNumComponents = 3;
				const uvNumComponents = 2;
				//console.log(groups[tex].positions);
				geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groups[tex].positions), positionNumComponents));
				geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(groups[tex].normals), normalNumComponents));
				geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(groups[tex].uvs), uvNumComponents));

				const color = 0xFFFFFF;

				const loader = new THREE.TextureLoader();
				const test_texture = loader.load('duke-tex/' + tex + '.png');
				test_texture.magFilter = THREE.NearestFilter; // Magnify filter
				test_texture.minFilter = THREE.NearestFilter; // Minimum filter


				// Set this or the texture only repeats once
				test_texture.wrapS = THREE.RepeatWrapping;
				test_texture.wrapT = THREE.RepeatWrapping;


				const material = new THREE.MeshStandardMaterial({color: 0xffffff, map: test_texture}); // Maybe use MeshLambertMaterial for no specular highlights?
				material.color = new THREE.Color(0xffffff);

				const world_mesh = new THREE.Mesh(geometry, material);
				scene.add(world_mesh);

			}

			/*
			for (var tex in groups) {

				const geometry = new THREE.BufferGeometry();
				const positionNumComponents = 3;
				const normalNumComponents = 3;
				const uvNumComponents = 2;
				geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groups[tex].positions), positionNumComponents));
				geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(groups[tex].normals), normalNumComponents));
				geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(groups[tex].uvs), uvNumComponents));

				const color = 0xFFFFFF;

				const loader = new THREE.TextureLoader();
				const test_texture = loader.load('testassets/img/' + tex + '.png');
				test_texture.magFilter = THREE.NearestFilter; // Magnify filter
				test_texture.minFilter = THREE.NearestFilter; // Minimum filter


				// Set this or the texture only repeats once
				test_texture.wrapS = THREE.RepeatWrapping;
				test_texture.wrapT = THREE.RepeatWrapping;


				const material = new THREE.MeshStandardMaterial({color, map: test_texture}); // Maybe use MeshLambertMaterial for no specular highlights?

				const world_mesh = new THREE.Mesh(geometry, material);
				this.scene.add(world_mesh);

			}
			*/

		}

		function convert_vec3d(pt) {
			var ret = new THREE.Vector3();
			ret.x = pt.x;
			ret.y = -pt.z;
			ret.z = pt.y;
			return ret;

			/*
			fprintf(fil, "%f", pt.x);
			fwrite(",", 1, 1, fil);
			fprintf(fil, "%f", -pt.z);
			fwrite(",", 1, 1, fil);
			fprintf(fil, "%f", pt.y);
			*/
		}



		// Return a move vector in the form of a normal
		function getMoveVector(forward, side) {
			let resultTemp = new THREE.Vector2();
			let lookDirTemp = new THREE.Vector2();
			let multiply = 1;

			// No need to calculate. Just exit.
			if (forward == 0 && side == 0) {
				lookDirTemp.x = 0;
				lookDirTemp.y = 0;
				return lookDirTemp;
			}


			// Get matrix elements that we're gonna multiply by
			const e = camera.matrixWorld.elements;
			lookDirTemp.set(e[8], e[10]).normalize(); // x, y


			// Two directions means half the power to go at 45 deg angle
			if (forward != 0 && side != 0) {
				multiply = 0.707106; // aka 45 degree angle normalized
			}

			if (forward > 0) {
				resultTemp.x += lookDirTemp.x * -multiply;
				resultTemp.y += lookDirTemp.y * -multiply;
			}
			else if (forward < 0) {
				resultTemp.x += lookDirTemp.x * multiply;
				resultTemp.y += lookDirTemp.y * multiply;
			}

			// Side vector is simply making x negative and then swapping x/y instead of doing matrix multiply
			if (side > 0) {
				resultTemp.y += lookDirTemp.x * -multiply;
				resultTemp.x += lookDirTemp.y * multiply;
			}
			else if (side < 0) {
				resultTemp.y += lookDirTemp.x * multiply;
				resultTemp.x += lookDirTemp.y * -multiply;
			}

			return resultTemp;
		}

		function animate()
		{
			var moveForward = 0;
			var moveSide = 0;
			var playerMoving = false;


			camera.rotation.x = camera.rotationX;
			camera.rotation.y = camera.rotationY;

			if (controls.keyStates['ArrowUp']) { // up arrow
				camera.rotationX += 0.025;
			}
			else if (controls.keyStates['ArrowDown']) { // down arrow
				camera.rotationX -= 0.025;
			}
			else if (controls.keyStates['ArrowLeft']) { // left arrow
				camera.rotationY += 0.025;
			}
			else if (controls.keyStates['ArrowRight']) { // right arrow
				camera.rotationY -= 0.025;
			}

			if (controls.keyStates['KeyW']) { // Forward
				moveForward = 1;
				playerMoving = true;
			}

			if (controls.keyStates['KeyA']) { // Strafe Left
				moveSide = -1;
				playerMoving = true;
			}

			if (controls.keyStates['KeyS']) { // Backward
				moveForward = -1;
				playerMoving = true;
			}

			if (controls.keyStates['KeyD']) { // Strafe Right
				moveSide = 1;
				playerMoving = true;
			}
			if (controls.keyStates['Space']) { // Go Up
				camera.position.y += 100;
			}
			if (controls.keyStates['KeyZ']) { // Go Down
				camera.position.y -= 100;
			}
			if (controls.keyStates['KeyC']) { // Go Down
				camera.position.y -= 100;
			}
			var lookDirection = getMoveVector(moveForward, moveSide);
			camera.position.x += lookDirection.x * 50;
			camera.position.z += lookDirection.y * 50;

			controls.update();
			renderer.render(scene, camera);
			requestAnimationFrame(animate);
		}
	    function openFullscreen() {
			var elem = renderer.domElement;
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.mozRequestFullScreen) { /* Firefox */
				elem.mozRequestFullScreen();
			} else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
				elem.webkitRequestFullscreen();
			} else if (elem.msRequestFullscreen) { /* IE/Edge */
				elem.msRequestFullscreen();
			}
			elem.style.width = '100%';
			elem.style.height = '100%';
	    }

		// Keyboard events
		function controls_keydown(event) {
			if (event.shiftKey == true) {
				controls.keyShift = true;
			}
			else {
				controls.keyShift = false;
			}
			if (event.ctrlKey == true) {
				controls.keyCtrl = true;
			}
			else {
				controls.keyCtrl = false;
			}
			if (event.keyCode == 13 && event.altKey) {
				openFullscreen();
			}
			controls.keyStates[event.code] = true;
			event.preventDefault();
		}
		function controls_keyup(event) {
			if (event.shiftKey == true) {
				controls.keyShift = true;
			}
			else {
				controls.keyShift = false;
			}
			if (event.ctrlKey == true) {
				controls.keyCtrl = true;
			}
			else {
				controls.keyCtrl = false;
			}
			controls.keyStates[event.code] = false;
			event.preventDefault();
		}
		document.addEventListener("keydown", controls_keydown);
		document.addEventListener("keyup", controls_keyup);

		function controls_mousedown(event) {
			if (mapLoaded) {
				document.body.requestPointerLock();
			}
			controls.mouseStates.left = true;
		}
		function controls_mouseup(event) {
			controls.mouseStates.left = false;
		}
		function controls_mousemove(event) {
			camera.rotationY -= event.movementX / 500;
			camera.rotationX -= event.movementY / 500;
		}
		document.addEventListener("mousedown", controls_mousedown);
		document.addEventListener("mouseup", controls_mouseup);
		document.body.addEventListener("mousemove", controls_mousemove);
	</script>
</body>
</html>