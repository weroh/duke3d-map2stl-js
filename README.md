# duke3d-map2stl-js
A JavaScript port of map2stl by Ken Silverman

MAP2STL.ZIP (9,494 bytes, 05/15/2009): A utility for converting Build .MAP files to .STL format (simple triangle soup). This may be useful for small test programs, although not much else since all texture and color information is lost during the conversion.(Win32)

http://advsys.net/ken/buildsrc/

So this start off as a build engine map exporter. Now it's a build engine map viewer using ThreeJS. Just a quick overview of what the code is:
* dukemap.js - Reads the Build Engine map (version 7) format. Probably should be called buildmap.js
* map2stl.c - The original source code that Ken Silverman wrote
* map2stl.js - The unofficial JavaScript port of that code with some additional features
* map2stl.php - The HTML and the ThreeJS viewer

The original exporter only exported triangles into a binary .stl file. The JavaScript version loads things into a JavaScript array and is viewed in the viewer. The triangles are listed in global variable `map2stl_output` which can be seen in the browser console.
