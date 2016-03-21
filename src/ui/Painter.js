import Format from "src/base/Format.js"
import Util from "src/base/Util.js"
import Seq from "src/base/Seq.js"
import Config from "src/Config.js"
import Rect from "src/math/Rect.js"
import Point from "src/math/Point.js"

export default class Painter {
    /**
     * @param {!HTMLCanvasElement} canvas
     * @property {!HTMLCanvasElement} canvas
     * @property {!CanvasRenderingContext2D} ctx
     * @property {!function()} deferred
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.deferred = [];
    }

    defer(tooltipPainter) {
        this.deferred.push(tooltipPainter);
    }

    paintDeferred() {
        for (let e of this.deferred) {
            e();
        }
        this.deferred = [];
    }

    paintableArea() {
        return new Rect(0, 0, this.canvas.width, this.canvas.height);
    }

    clear(color = Config.DEFAULT_FILL_COLOR) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draws a line segment between the two points.
     *
     * @param {!Point} p1
     * @param {!Point} p2
     * @param {=string} color The color of the drawn line.
     * @param {=number} thickness The thickness of the drawn line.
     */
    strokeLine(p1, p2, color = Config.DEFAULT_STROKE_COLOR, thickness = 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;
        this.ctx.stroke();
    };

    /**
     * Draws the outside of a rectangle.
     * @param {!Rect} rect The rectangular perimeter to stroke.
     * @param {!string=} color The stroke color.
     * @param {!number=} thickness The stroke thickness.
     */
    strokeRect(rect, color = "black", thickness = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;
        this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    /**
     * Draws the inside of a rectangle.
     * @param {!Rect} rect The rectangular area to fill.
     * @param {!string=} color The fill color.
     */
    fillRect(rect, color = Config.DEFAULT_FILL_COLOR) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    /**
     * Draws the outside of a circle.
     * @param {!Point} center The center of the circle.
     * @param {!number} radius The distance from the center of the circle to its side.
     * @param {!string=} color The stroke color.
     * @param {!number=} thickness The stroke thickness.
     */
    strokeCircle(center, radius, color = Config.DEFAULT_STROKE_COLOR, thickness = Config.DEFAULT_STROKE_THICKNESS) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;
        this.ctx.arc(center.x, center.y, Math.max(radius - 0.5, 0), 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    /**
     * Draws the outside of an ellipse.
     * @param {!Point} center The center of the ellipse.
     * @param {!Point} radii The horizontal and vertical distance from the center of the ellipse to its side.
     * @param {!string=} color The stroke color.
     * @param {!number=} thickness The stroke thickness.
     */
    strokeEllipse(center, radii, color = Config.DEFAULT_STROKE_COLOR, thickness = Config.DEFAULT_STROKE_THICKNESS) {
        this.ctx.save();
        this.ctx.beginPath();

        this.ctx.translate(center.x - radii.x, center.y - radii.y);
        this.ctx.scale(radii.x, radii.y);
        this.ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);

        this.ctx.restore();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = thickness;
        this.ctx.stroke();
    }

    /**
     * Draws the inside of a circle.
     * @param {!Point} center The center of the circle.
     * @param {!number} radius The distance from the center of the circle to its side.
     * @param {!string=} color The fill color. Defaults to white.
     */
    fillCircle(center, radius, color = Config.DEFAULT_FILL_COLOR) {
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, Math.max(radius - 0.5, 0), 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Draws some text within the given rectangular area, aligned based on the given proportional center, with
     * line breaking and (if line breaking isn't enough) font size reduction to make things fit.
     *
     * @param {!string} text
     * @param {!Rect} area
     * @param {!Point} proportionalCenterOfAlignment
     * @param {!string} fontColor
     * @param {!int} maxFontSize
     * @param {!string} fontFamily
     * @returns {!Rect} A minimal bounding rectangle containing the pixels affected by the text printing.
     */
    printParagraph(text,
                   area,
                   proportionalCenterOfAlignment = new Point(0, 0),
                   fontColor = Config.DEFAULT_TEXT_COLOR,
                   maxFontSize = Config.DEFAULT_FONT_SIZE,
                   fontFamily = Config.DEFAULT_FONT_FAMILY) {

        let fontSize;
        let ascendingHeightOf = metric => {
            let d = metric.fontBoundingBoxAscent;
            return d === undefined ? fontSize * 0.75 : d;
        };
        let descendingHeightOf = metric => {
            let d = metric.fontBoundingBoxDescent;
            return d === undefined ? fontSize * 0.25 : d;
        };
        let heightOf = metric => ascendingHeightOf(metric) + descendingHeightOf(metric);

        let lines;
        let measures;
        let height;
        let forcedLines = new Seq(text.split("\n"));
        for (let df = 0; ; df++) { // Note: potential for quadratic behavior.
            fontSize = maxFontSize - df;
            this.ctx.font = fontSize + "px " + fontFamily;
            lines = forcedLines.
                flatMap(line => Util.breakLine(line, area.w, s => this.ctx.measureText(s).width)).
                toArray();
            measures = lines.map(e => this.ctx.measureText(e));
            height = new Seq(measures).map(heightOf).sum();
            if (height <= area.h || fontSize <= 4) {
                break;
            }
        }

        let f = (offset, full, used, proportion) => offset + (full - used) * proportion;
        let fx = w => f(area.x, area.w, w, proportionalCenterOfAlignment.x);
        let fy = h => f(area.y, area.h, h, proportionalCenterOfAlignment.y);
        let y = fy(height);

        this.ctx.fillStyle = fontColor;

        let dy = 0;
        for (let i = 0; i < lines.length; i++) {
            dy += ascendingHeightOf(measures[i]);
            this.ctx.fillText(lines[i], fx(measures[i].width), y + dy);
            dy += descendingHeightOf(measures[i]);
        }

        let maxWidth = new Seq(measures).map(e => e.width).max(0);
        return new Rect(fx(maxWidth), y, maxWidth, height);
    }

    /**
     * Draws a single line of text, without line breaks, using font size reduction to make things fit.
     *
     * @param {!string} text
     * @param {!Rect} area
     * @param {!number|undefined=} proportionalCenterOfHorizontalAlignment
     * @param {!string|undefined=} fontColor
     * @param {!int|undefined=} maxFontSize
     * @param {!string|undefined=} fontFamily
     * @param {!number|undefined=} proportionalCenterOfVerticalAlignment
     * @returns {!Rect} A minimal bounding rectangle containing the pixels affected by the text printing.
     */
    printLine(text,
              area,
              proportionalCenterOfHorizontalAlignment = 0,
              fontColor = Config.DEFAULT_TEXT_COLOR,
              maxFontSize = Config.DEFAULT_FONT_SIZE,
              fontFamily = Config.DEFAULT_FONT_FAMILY,
              proportionalCenterOfVerticalAlignment = undefined) {

        let fontSize;
        let ascendingHeightOf = metric => {
            let d = metric.fontBoundingBoxAscent;
            return d === undefined ? fontSize * 0.75 : d;
        };
        let descendingHeightOf = metric => {
            let d = metric.fontBoundingBoxDescent;
            return d === undefined ? fontSize * 0.25 : d;
        };
        let heightOf = metric => ascendingHeightOf(metric) + descendingHeightOf(metric);

        let measure;
        for (let df = 0; ; df++) { // Note: potential for quadratic behavior.
            fontSize = maxFontSize - df;
            this.ctx.font = fontSize + "px " + fontFamily;
            measure = this.ctx.measureText(text);
            if ((measure.width <= area.w && heightOf(measure) <= area.h) || fontSize <= 4) {
                break;
            }
        }

        let h = heightOf(measure);
        let py = proportionalCenterOfVerticalAlignment === undefined ?
            ascendingHeightOf(measure) / h :
            proportionalCenterOfVerticalAlignment;
        let f = (offset, full, used, proportion) => offset + (full - used) * proportion;
        let x = f(area.x, area.w, measure.width, proportionalCenterOfHorizontalAlignment);
        let y = f(area.y, area.h, h, py);

        this.ctx.fillStyle = fontColor;
        this.ctx.fillText(text, x, y + ascendingHeightOf(measure));

        return new Rect(x, y, measure.width, h);
    }

    /**
     * Draws a grid.
     * @param {!Rect} topLeftCell
     * @param {!number} cols
     * @param {!number} rows
     * @param {=string} strokeColor
     * @param {=number} strokeThickness
     */
    strokeGrid(topLeftCell,
               cols,
               rows,
               strokeColor = Config.DEFAULT_STROKE_COLOR,
               strokeThickness = Config.DEFAULT_STROKE_THICKNESS) {
        let x = topLeftCell.x;
        let y = topLeftCell.y;
        let dw = topLeftCell.w;
        let dh = topLeftCell.h;
        let x2 = x + cols * dw;
        let y2 = y + rows * dh;
        this.ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
            this.ctx.moveTo(x + c * dw, y);
            this.ctx.lineTo(x + c * dw, y2);
        }
        for (let r = 0; r <= rows; r++) {
            this.ctx.moveTo(x, y + r * dh);
            this.ctx.lineTo(x2, y + r * dh);
        }

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeThickness;
        this.ctx.stroke();
    };

    /**
     * Draws the outside of a polygon.
     * @param {!(!Point[])} vertices
     * @param {!string=} strokeColor The stroke color.
     * @param {!number=} strokeThickness The stroke thickness.
     */
    strokePolygon(vertices,
                  strokeColor = Config.DEFAULT_STROKE_COLOR,
                  strokeThickness = Config.DEFAULT_STROKE_THICKNESS) {
        if (vertices.length === 0) {
            return;
        }
        let last = vertices[vertices.length - 1];

        this.ctx.beginPath();
        this.ctx.moveTo(last.x, last.y);
        for (let p of vertices) {
            this.ctx.lineTo(p.x, p.y);
        }

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeThickness;
        this.ctx.stroke();
    }

    /**
     * Draws a path.
     * @param {!(!Point[])} vertices
     * @param {!string=} strokeColor The stroke color.
     * @param {!number=} strokeThickness The stroke thickness.
     */
    strokePath(vertices,
                  strokeColor = Config.DEFAULT_STROKE_COLOR,
                  strokeThickness = Config.DEFAULT_STROKE_THICKNESS) {
        if (vertices.length === 0) {
            return;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let p of vertices.slice(1)) {
            this.ctx.lineTo(p.x, p.y);
        }

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeThickness;
        this.ctx.stroke();
    }

    /**
     * Draws the inside of a polygon.
     * @param {!(!Point[])} vertices
     * @param {!string} fillColor
     */
    fillPolygon(vertices, fillColor) {
        let last = vertices[vertices.length - 1];

        this.ctx.beginPath();
        this.ctx.moveTo(last.x, last.y);
        for (let p of vertices) {
            this.ctx.lineTo(p.x, p.y);
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
    }

    /**
     * @param {!number} x The x-position of the center of the arrow head.
     * @param {number} y The y-position of the center of the arrow head.
     * @param {number} radius The radius of the circle the arrow head is inscribed inside.
     * @param {number} facingAngle The direction the arrow head is pointing towards.
     * @param {number} sweptAngle The angle swept out by the back of the arrow head, relative to its center (not the
     * point at the front).
     * @param fillColor
     */
    fillArrowHead(x, y, radius, facingAngle, sweptAngle, fillColor = 'black') {
        let a1 = facingAngle + sweptAngle/2 + Math.PI;
        let a2 = facingAngle - sweptAngle/2 + Math.PI;
        this.fillPolygon([
            new Point(x + Math.cos(facingAngle)*radius, y + Math.sin(facingAngle)*radius),
            new Point(x + Math.cos(a1)*radius, y + Math.sin(a1)*radius),
            new Point(x + Math.cos(a2)*radius, y + Math.sin(a2)*radius)
        ], fillColor);
    }
}
