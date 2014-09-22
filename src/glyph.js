// Vex Flow
// Mohit Muthanna <mohit@muthanna.com>
//
// Copyright Mohit Muthanna 2010
//
// Requires a glyph font to be loaded and Vex.Flow.Font to be set.

/**
 * A quick and dirty static glyph renderer. Renders glyphs from the default
 * font defined in Vex.Flow.Font.
 *
 * @param {!Object} ctx The canvas context.
 * @param {number} x_pos X coordinate.
 * @param {number} y_pos Y coordinate.
 * @param {number} point The point size to use.
 * @param {string} val The glyph name in Vex.Flow.Font.
 * @param {boolean} nocache If set, disables caching of font outline.
 */
Vex.Flow.renderGlyph = function(ctx, x_pos, y_pos, scale, val, nocache) {
  if (typeof scale !== 'number') {
    nocache = val;
    val = scale;
    scale = null;
  }

  var glyph = new Vex.Flow.Glyph(val, scale);
  glyph.render(ctx, x_pos, y_pos);
};

/**
 * @constructor
 */
Vex.Flow.Glyph = (function() {
  function Glyph(glyph_name, scale, options) {
    this.glyph_name = glyph_name;
    this.point = Vex.Flow.FontLoader.getFontSize(glyph_name) * (scale || 1);
    this.context = null;
    this.options = {
      cache: true,
      font: Vex.Flow.Font
    };

    this.width = null;
    this.metrics = null;
    this.x_shift = 0;
    this.y_shift = 0;
    this.rotation = 0;

    this.origin_horizontal = "default";
    this.origin_vertical = "default";
    this.origin_y_shift = 0;
    this.origin_x_shift = 0;

    if (options) this.setOptions(options); else this.reset();
  }

  Glyph.DEBUG = false;

  function L() { if (Glyph.DEBUG) Vex.L("Vex.Flow.Glyph", arguments); }

  Glyph.prototype = {
    setOptions: function(options) {
      Vex.Merge(this.options, options);
      this.reset();
    },

    setStave: function(stave) { this.stave = stave; return this; },
    setXShift: function(x_shift) {
      this.x_shift = x_shift; 
      return this; 
    },
    setYShift: function(y_shift) { this.y_shift = y_shift; return this; },
    setRotation: function(degrees) { this.rotation = degrees; return this; }, 
    setContext: function(context) { this.context = context; return this; },
    getContext: function() { return this.context; },

    reset: function() {
      this.metrics = Vex.Flow.FontLoader.loadGlyphMetrics(this.glyph_name, this.options.cache);

      if (this.metrics.advanceWidth){
        this.scale = 1 / this.options.font.resolution * this.point;
        this.setWidth(this.metrics.advanceWidth * this.scale);
        this.setHeight(this.metrics.ha * 250 * this.scale);
        this.setBoundingBox(this.metrics.bb);
      } else { // Gonville seems to have some weird font handling
        this.scale = this.point * 72 / (this.options.font.resolution * 100);
        this.setWidth((this.metrics.x_max - this.metrics.x_min) * this.scale);
        this.setHeight(this.metrics.ha * this.scale);
      }
    },

    setBoundingBox: function(bb) {
      this.bb =  {
        "nw": {
          x: bb.NW.x * 250 * this.scale,
          y: bb.NW.y * 250 * this.scale,
        },
        "sw": {
          x: bb.SW.x * 250 * this.scale,
          y: bb.SW.y * 250 * this.scale,
        },
        "ne": {
          x: bb.NE.x * 250 * this.scale,
          y: bb.NE.y * 250 * this.scale,
        },
        "se": {
          x: bb.SE.x * 250 * this.scale,
          y: bb.SE.y * 250 * this.scale,
        },
      };
    },

    setVerticalOrigin: function(origin) {
      var originShifts = {
        'bottom': this.bb.sw.y,
        'top': this.bb.nw.y,
        'center': this.bb.sw.y + (this.height / 2),
        'default': 0
      };

      this.origin_y = origin;
      this.origin_y_shift = originShifts[origin];

      if (this.origin_y_shift === undefined) {
        throw new Vex.RuntimeError('Invalid horizontal origin');
      }
    },

    setHorizontalOrigin: function(origin) {
      var originShifts = {
        'left': this.bb.sw.x,
        'right': this.bb.sw.x - this.getWidth(),
        'center': this.bb.sw.x - this.getCenterWidth(),
        'default': 0
      };

      this.origin_x = origin;
      this.origin_x_shift = originShifts[origin];

      if (this.origin_x_shift === undefined) {
        throw new Vex.RuntimeError('Invalid vertical origin');
      }
    },

    setWidth: function(width) {
      this.width =  width;
      return this;
    },

    setHeight: function(height) {
      this.height = height;
      return this;
    },

    getWidth: function(){ return this.width; },
    getHeight: function(){ return this.height; },

    getCenterWidth: function(){
      return this.width / 2;
    },

    getMetrics: function() {
      if (!this.metrics) throw new Vex.RuntimeError("BadGlyph", "Glyph " +
          this.glyph_name + " is not initialized.");
        
      return {
        x_min: this.metrics.x_min * this.scale,
        x_max: this.metrics.x_max * this.scale,
        width: this.width,
        height: this.metrics.ha * this.scale
      };
    },

    hasCenterOrigin: function(){
      return Vex.Flow.FontLoader.getHorizontalOriginPosition(this.glyph_name) === "center";
    },

    hasRightOrigin: function(){
      return Vex.Flow.FontLoader.getHorizontalOriginPosition(this.glyph_name) === "right";
    },

    render: function(ctx, x_pos, y_pos) {
      if (!this.metrics) throw new Vex.RuntimeError("BadGlyph", "Glyph " +
          this.glyph_name + " is not initialized.");

      if (x_pos === undefined || y_pos === undefined || isNaN(x_pos) || isNaN(y_pos)) {
        throw new Vex.RuntimeError('X or Y position is undefined or NaN');
      }

      var outline = this.metrics.outline;
      var scale = this.scale;

      // Translate as if origin was to the left side of the glyph
      if (this.hasCenterOrigin()){
        x_pos += this.width/2;
      } else if (this.hasRightOrigin()){
        x_pos += this.width;
      }

      ctx.save();

      var radians = this.rotation * (Math.PI/ 180);
      if (radians) {
        ctx.translate(x_pos, y_pos);
        ctx.rotate(radians);
        ctx.translate(-x_pos, -y_pos);
      }

      Glyph.renderOutline(ctx, outline, scale, x_pos + this.origin_x_shift, y_pos + this.origin_y_shift);

      if (Glyph.DEBUG){
        Vex.drawCross(ctx, x_pos, y_pos);
      }

      ctx.restore();
    },

    renderToStave: function(x) {
      if (!this.metrics) throw new Vex.RuntimeError("BadGlyph", "Glyph " +
          this.glyph_name + " is not initialized.");
      if (!this.stave) throw new Vex.RuntimeError("GlyphError", "No valid stave");
      if (!this.context) throw new Vex.RERR("GlyphError", "No valid context");

      var outline = this.metrics.outline;
      var scale = this.scale;
      var x_pos = x + this.x_shift;
      var y_pos = this.stave.getYForGlyphs() + this.y_shift;

      Glyph.renderOutline(this.context, outline, scale, x_pos, y_pos);

      if (Glyph.DEBUG){
        Vex.drawCross(this.context, x_pos, y_pos);      
      }
    }
  };

  Glyph.renderOutline = function(ctx, outline, scale, x_pos, y_pos) {
    var outlineLength = outline.length;

    ctx.beginPath();

    ctx.moveTo(x_pos, y_pos);

    for (var i = 0; i < outlineLength; ) {
      var action = outline[i++];
      var x, y;
      switch(action) {
        case 'm':
          x = x_pos + outline[i++] * scale;
          y = y_pos + outline[i++] * -scale;

          ctx.moveTo(x, y);
          break;
        case 'l':
          x = x_pos + outline[i++] * scale;
          y = y_pos + outline[i++] * -scale;

          ctx.lineTo(x,y);
          break;
        case 'q':
          var cpx = x_pos + outline[i++] * scale;
          var cpy = y_pos + outline[i++] * -scale;

          x = x_pos + outline[i++] * scale;
          y = y_pos + outline[i++] * -scale;

          ctx.quadraticCurveTo(x, y, cpx, cpy);
          break;
        case 'b':
          x = x_pos + outline[i++] * scale;
          y = y_pos + outline[i++] * -scale;

          var x1 = x_pos + outline[i++] * scale;
          var y1 = y_pos + outline[i++] * -scale;

          var x2 = x_pos + outline[i++] * scale;
          var y2 = y_pos + outline[i++] * -scale;

          ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
          break;
      }
    }
    ctx.fill();
  };

  return Glyph;
}());
