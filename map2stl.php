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

	<script src="map2stl_dukemap.js"></script>
	<script src="map2stl.js"></script>
</body>
</html>