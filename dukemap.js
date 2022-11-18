var DukeMap = {
  loadURL: function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    var self = this;
    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = this.response;
        self.load(blob);
      }
    };
    xhr.send();
  },

  offset: 0,

  map: {},

  resetMap: function() {
    this.map = {
      version: 0,
      playerStart: {
        x: 0,
        y: 0,
        z: 0,
        ang: 0
      },
      cursectnum: 0,

      numsects: 0,
      sectors: [],

      numwalls: 0,
      walls: [],

      numsprites: 0,
      sprites: []
    };
  },

  read: function(type) {
    /*
      UINT8   Unsigned 8-bit integer
      UINT16LE  Unsigned 16-bit integer in little-endian format
      UINT16BE  Unsigned 16-bit integer in big-endian format
      UINT32LE  Unsigned 32-bit integer in little-endian format
      UINT32BE  Unsigned 32-bit integer in big-endian format 
    */
    var result;
    switch (type) {

      // INT 8
      case "INT8":
        result = this.dataReader.getInt8(this.offset);
        this.offset += 1;
      break;
      case "UINT8":
        result = this.dataReader.getUint8(this.offset);
        this.offset += 1;
      break;


      // INT 16
      case "INT16LE":
        result = this.dataReader.getInt16(this.offset, true);
        this.offset += 2;
      break;
      case "INT16BE":
        result = this.dataReader.getInt16(this.offset, false);
        this.offset += 2;
      break;
      case "UINT16LE":
        result = this.dataReader.getUint16(this.offset, true);
        this.offset += 2;
      break;
      case "UINT16BE":
        result = this.dataReader.getUint16(this.offset, false);
        this.offset += 2;
      break;

      // INT 32
      case "INT32LE":
        result = this.dataReader.getInt32(this.offset, true);
        this.offset += 4;
      break;
      case "INT32BE":
        result = this.dataReader.getInt32(this.offset, false);
        this.offset += 4;
      break;
      case "UINT32LE":
        result = this.dataReader.getUint32(this.offset, true);
        this.offset += 4;
      break;
      case "UINT32BE":
        result = this.dataReader.getUint32(this.offset, false);
        this.offset += 4;
      break;

      default:
        console.log("read invalid type: " + type);
    }

    return result;
  },

  load: function(blob) {
    var self = this;
    var reader = new FileReader();

    // Resets the map object

    reader.readAsArrayBuffer(blob);
    //reader.onprogress = self.onProgress;

    reader.onload = function(e) {
      self.data = e.target.result;

      // header reading
      self.dataReader = new DataView(e.target.result);

      self.resetMap();

      self.map.version = self.read("INT32LE");
      if (self.map.version == 7 || self.map.version == 8) {

        self.map.playerStart = {
          x: self.read("INT32LE"),
          y: self.read("INT32LE"),
          z: self.read("INT32LE"),
          ang: self.read("INT16LE"),
        };

        self.map.cursectnum = self.read("INT16LE");
        //console.log("cursectnum: " + self.map.cursectnum);

        // Get number of sectors first
        self.offset = 20;
        self.map.numsects = self.read("UINT16LE");
        self.map.sectors = [];
        for (i=0;i<self.map.numsects;i++) {
          self.map.sectors.push(self.read_sector());
        }

        self.map.numwalls = self.read("UINT16LE");
        self.map.walls = [];
        for (i=0;i<self.map.numwalls;i++) {
          self.map.walls.push(self.read_wall());
        }

        self.map.numsprites = self.read("UINT16LE");
        self.map.numsprites = [];
        for (i=0;i<self.map.numsprites;i++) {
          self.map.sprites.push(self.read_sprite());
        }
      }
      else {
        console.log("not Build1 .MAP format 7");
      }

      if (typeof self.onLoad === "function") {
        self.onLoad();
      }
    }


  },

  bit: [
    1, 2, 4, 8, 16, 32, 64, 128,
    256, 512, 1024, 2048, 4096, 8192, 16384, 32768
  ],

  read_sprite_stat(stat) {
    var result = {
      /*
      bit 0: 1 = Blocking sprite (use with clipmove, getzrange)
      bit 1: 1 = transluscence, 0 = normal
      bit 2: 1 = x-flipped, 0 = normal
      bit 3: 1 = y-flipped, 0 = normal
      bits 5-4: 
          00 = FACE sprite (default)
          01 = WALL sprite (like masked walls)
          10 = FLOOR sprite (parallel to ceilings&floors)
      bit 6: 1 = 1-sided sprite, 0 = normal
      bit 7: 1 = Real centered centering, 0 = foot center
      bit 8: 1 = Blocking sprite (use with hitscan / cliptype 1)
      bit 9: 1 = Transluscence reversing, 0 = normal
      bits 10-14: reserved
      bit 15: 1 = Invisible sprite, 0 = not invisible
      */
      blocking_clipmove: (stat & DukeMap.bit[0]) != 0,
      transluscence: (stat & DukeMap.bit[1]) != 0,
      xflip: (stat & DukeMap.bit[2]) != 0,
      yflip: (stat & DukeMap.bit[3]) != 0,
      //face: (stat & DukeMap.bit[4]) != 0,

      type: "",

      onesided: (stat & DukeMap.bit[6]) != 0,
      realcenter: (stat & DukeMap.bit[7]) != 0,
      blocking_hitscan: (stat & DukeMap.bit[8]) != 0,
      transluscence_rev: (stat & DukeMap.bit[9]) != 0,
      invisible: (stat & DukeMap.bit[15]) != 0,
    };

    var bits4 = (stat & DukeMap.bit[4]) != 0;
    var bits5 = (stat & DukeMap.bit[5]) != 0;

    if (bits4 == false && bits5 == false) {
      result.type = "FACE";
    }
    if (bits4 == false && bits5 == true) {
      result.type = "WALL";
    }
    if (bits4 == true && bits5 == false) {
      result.type = "FLOOR";
    }

    return result;
  },

  read_wall_stat(stat) {
    var result = {
      /*  
      bit 0: 1 = Blocking wall (use with clipmove, getzrange)
      bit 1: 1 = bottoms of invisible walls swapped, 0 = not
      bit 2: 1 = align picture on bottom (for doors), 0 = top
      bit 3: 1 = x-flipped, 0 = normal
      bit 4: 1 = masking wall, 0 = not
      bit 5: 1 = 1-way wall, 0 = not
      bit 6: 1 = Blocking wall (use with hitscan / cliptype 1)
      bit 7: 1 = Transluscence, 0 = not
      bit 8: 1 = y-flipped, 0 = normal
      bit 9: 1 = Transluscence reversing, 0 = normal
      bits 10-15: reserved
      */
      blocking_clipmove: (stat & DukeMap.bit[0]) != 0,
      bottomswap: (stat & DukeMap.bit[1]) != 0,
      alignpicbottom: (stat & DukeMap.bit[2]) != 0,
      xflip: (stat & DukeMap.bit[3]) != 0,
      masking: (stat & DukeMap.bit[4]) != 0,
      oneway: (stat & DukeMap.bit[5]) != 0,
      blocking_hitscan: (stat & DukeMap.bit[6]) != 0,
      transluscence: (stat & DukeMap.bit[7]) != 0,
      yflip: (stat & DukeMap.bit[8]) != 0,
      transluscence_rev: (stat & DukeMap.bit[9]) != 0,
    };
    return result;
  },

  read_sector_stat(stat) {
    /*
    bit 0: 1 = parallaxing, 0 = not
    bit 1: 1 = sloped, 0 = not
    bit 2: 1 = swap x&y, 0 = not
    bit 3: 1 = double smooshiness
    bit 4: 1 = x-flip
    bit 5: 1 = y-flip
    bit 6: 1 = Align texture to first wall of sector
    bits 7-15: reserved
    */
    var result = {
      parallaxing: (stat & DukeMap.bit[0]) != 0,
      sloped: (stat & DukeMap.bit[1]) != 0,
      swap: (stat & DukeMap.bit[2]) != 0,
      double: (stat & DukeMap.bit[3]) != 0,
      xflip: (stat & DukeMap.bit[4]) != 0,
      yflip: (stat & DukeMap.bit[5]) != 0,
      align: (stat & DukeMap.bit[6]) != 0,
    };

    //console.log(result);

    return result;
  },

  // SPECS https://moddingwiki.shikadi.net/wiki/MAP_Format_(Build)#Version_7
  read_sector() {
    self = this;
    var sector = {
      wallptr: self.read("INT16LE"),
      wallnum: self.read("INT16LE"),
      ceilingz: self.read("INT32LE"),
      floorz: self.read("INT32LE"),
      ceilingstat: self.read("INT16LE"),
      floorstat: self.read("INT16LE"),
      ceilingpicnum: self.read("INT16LE"),
      ceilingheinum: self.read("INT16LE"),
      ceilingshade: self.read("INT8"),
      ceilingpal: self.read("UINT8"),
      ceilingxpanning: self.read("UINT8"),
      ceilingypanning: self.read("UINT8"),
      floorpicnum: self.read("INT16LE"),
      floorheinum: self.read("INT16LE"),
      floorshade: self.read("INT8"),
      floorpal: self.read("UINT8"),
      floorxpanning: self.read("UINT8"),
      floorypanning: self.read("UINT8"),
      visibility: self.read("UINT8"),
      filler: self.read("UINT8"),
      lotag: self.read("INT16LE"),
      hitag: self.read("INT16LE"),
      extra: self.read("INT16LE")
    };

    sector.ceilingstat_ = self.read_sector_stat(sector.ceilingstat);
    sector.floorstat_ = self.read_sector_stat(sector.floorstat);

    return sector;
  },

  read_wall() {
    self = this;
    var wall = {
      x: self.read("INT32LE"),
      y: self.read("INT32LE"),
      point2: self.read("INT16LE"),
      nextwall: self.read("INT16LE"),
      nextsector: self.read("INT16LE"),
      cstat: self.read("INT16LE"),
      picnum: self.read("INT16LE"),
      overpicnum: self.read("INT16LE"),
      shade: self.read("INT8"),
      pal: self.read("UINT8"),
      xrepeat: self.read("UINT8"),
      yrepeat: self.read("UINT8"),
      xpanning: self.read("UINT8"),
      ypanning: self.read("UINT8"),
      lotag: self.read("INT16LE"),
      hitag: self.read("INT16LE"),
      extra: self.read("INT16LE")
    };

    wall.cstat_ = self.read_wall_stat(wall.cstat);

    return wall;
  },

  read_sprite() {
    self = this;
    var sprite = {
      x: self.read("INT32LE"),
      y: self.read("INT32LE"),
      z: self.read("INT32LE"),
      cstat: self.read("INT16LE"),
      picnum: self.read("INT16LE"),
      shade: self.read("INT8"),
      pal: self.read("UINT8"),
      clipdist: self.read("UINT8"),
      filler: self.read("UINT8"),
      xrepeat: self.read("UINT8"),
      yrepeat: self.read("UINT8"),
      xoffset: self.read("INT8"),
      yoffset: self.read("INT8"),
      sectnum: self.read("INT16LE"),
      statnum: self.read("INT16LE"),
      ang: self.read("INT16LE"),
      owner: self.read("INT16LE"),
      xvel: self.read("INT16LE"),
      yvel: self.read("INT16LE"),
      zvel: self.read("INT16LE"),
      lotag: self.read("INT16LE"),
      hitag: self.read("INT16LE"),
      extra: self.read("INT16LE")
    };

    sprite.cstat_ = self.read_sprite_stat(sprite.cstat);

    return sprite;
  }

};