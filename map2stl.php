<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title></title>
</head>
<body style="background: #000;color:#fff">
	<script src="jquery.min.js"></script>

	<ul>
		<?php
		$files = scandir('.');
		foreach ($files as $filename) {
			$pi = pathinfo($filename);

			if (isset($pi['extension']) && strtolower($pi['extension']) == 'map') {
				echo '<li class="loadmap"><a href="#" data-filename="' . $filename . '">' . $filename . '</a></li>';
			}
		}
		?>
	</ul>

	(See Browser Console for output)

	<script src="dukemap.js"></script>
	<script src="map2stl.js"></script>

	<script src="three/three.min.js"></script>
	<script src="three/OrbitControls.js"></script>

	<script>

		var scene, renderer, camera;
		var cube;
		var controls;

		init();
		animate();

		function init()
		{

		    scene = new THREE.Scene();

		    renderer = new THREE.WebGLRenderer({antialias:true});
		    var width = window.innerWidth;
		    var height = window.innerHeight;
		    renderer.setSize(width, height);
		    document.body.appendChild(renderer.domElement);

		    camera = new THREE.PerspectiveCamera(45, width/height, 1, 10000);
		    camera.position.y = 160;
		    camera.position.z = 400;
		    camera.lookAt(new THREE.Vector3(0,0,0));

		    controls = new THREE.OrbitControls(camera, renderer.domElement);
		    
		    var gridXZ = new THREE.GridHelper(1000, 50);
		    scene.add(gridXZ);

		    const axesHelper = new THREE.AxesHelper( 50 );
		    scene.add( axesHelper );
		}

		// Loads from map2stl into threejs
		function loadGeometry() {
			const groups = {};

			//const positions = [];
			for (let i=0;i<line_count;i++) {
				//-0.000000,-0.000000,1.000000|28.000000,86.000000,-4.875000|26.500000,87.000000,-4.875000|26.777779,87.000000,-4.875000|
				//normalxyz|xyz|xyz|xyz

				for (v=0;v<map2stl_output.normals.length;v++) {
					var point = map2stl_output.normals[v];
					normals.push(point.x);
					normals.push(point.y);
					normals.push(point.z);
				}
				for (v=0;v<map2stl_output.verts.length;v++) {
					var point = map2stl_output.verts[v];
					verts.push(point.x);
					verts.push(point.y);
					verts.push(point.z);
				}

				/*
				if (Math.abs(temp_normals[1]) > Math.abs(temp_normals[0]) && Math.abs(temp_normals[1]) > Math.abs(temp_normals[2])) { // floor and ceiling
					uvs.push(parts[1][0]);
					uvs.push(parts[1][2]);
					uvs.push(parts[2][0]);
					uvs.push(parts[2][2]);
					uvs.push(parts[3][0]);
					uvs.push(parts[3][2]);
				}
				else if (Math.abs(temp_normals[0]) > Math.abs(temp_normals[1]) && Math.abs(temp_normals[0]) > Math.abs(temp_normals[2])) { // standing wall
					uvs.push(parts[1][1]);
					uvs.push(parts[1][2]);
					uvs.push(parts[2][1]);
					uvs.push(parts[2][2]);
					uvs.push(parts[3][1]);
					uvs.push(parts[3][2]);
				}
				else if (Math.abs(temp_normals[2]) > Math.abs(temp_normals[1]) && Math.abs(temp_normals[2]) > Math.abs(temp_normals[0])) { // standing wall
					uvs.push(parts[1][1]);
					uvs.push(parts[1][0]);
					uvs.push(parts[2][1]);
					uvs.push(parts[2][0]);
					uvs.push(parts[3][1]);
					uvs.push(parts[3][0]);
				}
				else {
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
					uvs.push(0);
				}



				var picnum1 = parseInt(parts[4]);
				var picnum2 = parseInt(parts[5]);
				if (!isNaN(picnum1) && !isNaN(picnum2)) {
					picnum1 = parseInt(picnum1);
					picnum2 = parseInt(picnum2);


					var tex_file = 'TILES' + ('000'+picnum2).slice(-3);
					tex_file += "_" + picnum1;
					
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
				*/
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

			    // Collisions?
				this.worldOctree.fromGraphNode(world_mesh);
				world_mesh.traverse(child => {
					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
						if (child.material.map) {
							//child.material.map.anisotropy = 8; // NOTE: Don't set or it's gonna blur the textures. We want pixels!
						}
					}
				});

			}
			*/
		}

		function animate()
		{
		    controls.update();
		    renderer.render(scene, camera);
		    requestAnimationFrame(animate);
		}

	</script>
</body>
</html>