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

		const vertexShader = `
		//#define USE_FOG
		varying vec2 vUv;
		attribute vec3 color;
		attribute float afognear;
		attribute float afogfar;
		varying vec3 vColor;

		varying vec4 fogColor;
		varying float fogNear;
		varying float fogFar;
		#include <fog_pars_vertex>
		void main(){
			vUv = uv;
			vColor = color;

			fogColor = vec4(0.5, 0.5, 0.5, 0.0);
			fogNear = 1000.0;
			fogFar = 1000000.0;


	        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
	        gl_Position = projectionMatrix * mvPosition;
	        
	        //fogDepth = - mvPosition.z;


			#include <fog_vertex>
		}
		`;

		const fragmentShader = `
		//#define USE_FOG
		varying vec2 vUv;
		varying vec3 vColor;
		uniform sampler2D tex;

		#include <fog_pars_fragment>
		void main(){
			vec4 shadeColor = vec4(vColor.rgb, 1.0);
			gl_FragColor = shadeColor * texture2D(tex, vUv);
			#include <fog_fragment>
		}
		`;

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

		function shade_to_float(shade) {
			/*
			var s = shade + 128;
			var ret = (s / 256);

			// Invert
			ret = 1 - ret;
			*/

			var s = 32 - shade;

			// Clamp
			if (s > 32) { s = 32; }
			if (s < 0) { s = 0; }

			s = s / 32;

			return parseFloat(s);
		}

		// Loads from map2stl into threejs
		function loadGeometry() {
			const groups = {};
			const normals = [];
			const verts = [];
			//console.log(map2stl_output);
			for (i=0;i<map2stl_output.length;i++) {
				const item = map2stl_output[i];
				const surfsector = dukemap.map.sectors[item.sec];
				const wall = item.wall;

				let verts = [];
				let color = [];
				var positions = [];
				let temp_normals = [];
				let normals = [];
				let uvs = [];

				//let fog = new THREE.Fog(0x000000, 0, 3000);

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

				var picnum = 0;
				var uv_scale_x = 512;
				var uv_scale_y = 512;
				var uv_offset_x = 0;
				var uv_offset_y = 0;
				if (item.type == "wall") {
					picnum = item.wal.orig.picnum;
					if (item.wal.orig.overpicnum != 0) {
						picnum = item.wal.orig.overpicnum;
						//console.log(item.wal.orig.overpicnum);
						//console.log(get_tile_name(picnum));
					}
					var rgb = shade_to_float(item.wal.orig.shade);
					for (t=0;t<3;t++) {
						color.push(rgb);
						color.push(rgb);
						color.push(rgb);
					}
				}
				else if (item.type == "floor") {
					picnum = surfsector.floorpicnum;
					var rgb = shade_to_float(surfsector.floorshade);
					for (t=0;t<3;t++) {
						color.push(rgb);
						color.push(rgb);
						color.push(rgb);
					}
				}
				else if (item.type == "ceil") {
					picnum = surfsector.ceilingpicnum;
					var rgb = shade_to_float(surfsector.ceilingshade);
					for (t=0;t<3;t++) {
						color.push(rgb);
						color.push(rgb);
						color.push(rgb);
					}
				}
				else {
					for (t=0;t<3;t++) {
						color.push(1);
						color.push(1);
						color.push(1);
					}
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
						color: [],
						fognear: [],
						fogfar: [],
					};
				}

				groups[tex_file].positions.push(...positions);
				groups[tex_file].normals.push(...normals);
				groups[tex_file].uvs.push(...uvs);
				groups[tex_file].color.push(...color);
				//groups[tex_file].fognear.push(...fognear);
				//groups[tex_file].fogfar.push(...fogfar);
			}


			for (var tex in groups) {

				const geometry = new THREE.BufferGeometry();
				const positionNumComponents = 3;
				const normalNumComponents = 3;
				const uvNumComponents = 2;

				geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groups[tex].positions), 3));
				geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(groups[tex].normals), 3));
				geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(groups[tex].uvs), 2));
				geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groups[tex].color), 3));
				//geometry.setAttribute('afognear', new THREE.BufferAttribute(new Float32Array(groups[tex].fognear), 3));
				//geometry.setAttribute('afogfar', new THREE.BufferAttribute(new Float32Array(groups[tex].fogfar), 3));

				const color = 0xFFFFFF;

				const loader = new THREE.TextureLoader();
				const test_texture = loader.load('duke-tex/' + tex + '.png');
				test_texture.magFilter = THREE.NearestFilter; // Magnify filter
				test_texture.minFilter = THREE.NearestFilter; // Minimum filter

				// Set this or the texture only repeats once
				test_texture.wrapS = THREE.RepeatWrapping;
				test_texture.wrapT = THREE.RepeatWrapping;

				/*
				const material = new THREE.MeshStandardMaterial({color: 0xffffff, map: test_texture}); // Maybe use MeshLambertMaterial for no specular highlights?
				material.color = new THREE.Color(0xffffff);
				*/

				// NOTE: Alpha testing is done in the shader
				const material = new THREE.ShaderMaterial({
					vertexShader: vertexShader,
					fragmentShader: fragmentShader,
					//transparent: true,
					uniforms: {
						tex:   { type: "t", value: test_texture },

						/*
						fogColor:    { type: "c", value: fog.color },
						fogNear:     { type: "f", value: fog.near },
						fogFar:      { type: "f", value: fog.far }
						*/
					}
				});
				material.color = new THREE.Color(0xffffff);

				const world_mesh = new THREE.Mesh(geometry, material);
				scene.add(world_mesh);

			}

			for (i=0;i<dukemap.map.sprites.length;i++) {
				const sprite = dukemap.map.sprites[i];
				const tex = get_tile_name(sprite.picnum);
				const test_texture = new THREE.TextureLoader().load('duke-tex/' + tex + '.png');
				test_texture.magFilter = THREE.NearestFilter; // Magnify filter
				test_texture.minFilter = THREE.NearestFilter; // Minimum filter
				const material = new THREE.SpriteMaterial({ map: test_texture });
				material.color = new THREE.Color(0xffffff);

				const sprite_sector = dukemap.map.sectors[sprite.sectnum];

				const obj = new THREE.Sprite(material);
				var pos = convert_vec3d(sprite);
				obj.position.copy(pos);
				obj.position.y = sprite_sector.floorz + pos.y;
				obj.scale.set( sprite.clipdist * 16, sprite.clipdist * 16, sprite.clipdist * 16 );
				scene.add(obj);
			}

		}

		function convert_vec3d(pt) {
			var ret = new THREE.Vector3();
			ret.x = pt.x;
			ret.y = -pt.z;
			ret.z = pt.y;
			return ret;
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
			if (document.pointerLockElement === document.body) {
				camera.rotationY -= event.movementX / 500;
				camera.rotationX -= event.movementY / 500;
			}
		}
		document.addEventListener("mousedown", controls_mousedown);
		document.addEventListener("mouseup", controls_mouseup);
		document.body.addEventListener("mousemove", controls_mousemove);
	</script>
</body>
</html>