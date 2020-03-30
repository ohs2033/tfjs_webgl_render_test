import FragShader from './shader1.frag'
import VertexShader from './shader1.vert'
import createShader from 'gl-shader'
import * as bodyPix from '@tensorflow-models/body-pix';
import Stats from "stats.js";
const stats = new Stats();

var curZp = null;
var playId = null;

document.body.appendChild(stats.dom);
var offScreenCanvases = {};
var blur_1 = require("./blur");

const videoElement = document.getElementById("video");
let net = null

const main = async () => {
    if (net === null) {
        net = await bodyPix.load(/** optional arguments, see below **/{
            multiplier: 1.00,
            quantBytes: 2
        });
    }
    const onLoadedData = () => {
        videoElement.play();
        playId = requestAnimationFrame(render);
    };
    videoElement.addEventListener("loadeddata", onLoadedData);
}




const render = async () => {
    stats.begin()
    /**
     * Model Inference
     */
    const multiPartSegmentation = await net.segmentMultiPersonParts(videoElement);
    const curZoomPoints = multiPartSegmentation.map(getZoomPoint)
    const zps = []
    let smallDistance = -1;
    let closestIndex = -1;
    let distance = -1;
    if (curZp === null) {
        curZp = curZoomPoints[1]
        closestIndex = 1
    } else {
        curZoomPoints.forEach((zp, idx) => {
            distance = Math.abs(curZp[0] - zp[0]) + Math.abs(curZp[1] - zp[1])
            if (smallDistance < 0) {
                smallDistance = distance;
                closestIndex = idx
            } else if (smallDistance > distance) {
                smallDistance = distance;
                closestIndex = idx
            }
            zps.push(zp)
        })
        curZp = zps[closestIndex]
    }

    const partSegmentation = multiPartSegmentation[closestIndex]
    const edgeBlurAmount = 6;
    const mask = getMaskImage(partSegmentation, edgeBlurAmount)
    const canvasElement = document.getElementById('canvas');
    const gl = canvasElement.getContext('webgl');

    if (!gl) {
        window.alert('No webgl available!')
    }

    // create shader
    const shader = createShader(gl, VertexShader, FragShader);
    const program = shader.program;

    gl.useProgram(program);

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");
    var positionBuffer = gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Set a rectangle the same size as the image.
    setRectangle(gl, 0, 0, videoElement.width, videoElement.height);
    var texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,
    ]), gl.STATIC_DRAW);

    setupTexture(gl, mask, 0, program, "u_image");
    setupTexture(gl, videoElement, 1, program, "u_image2");


    var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    var zoomLocation = gl.getUniformLocation(program, 'zoom_point');

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of posit
    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);
    // Turn on the teccord attribute

    gl.enableVertexAttribArray(texcoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        texcoordLocation, size, type, normalize, stride, offset);

    // set the resolution
    // console.log('RESOLUTION', gl.canvas.width, gl.canvas.height)
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    // console.log(zoomPoint[0] / gl.canvas.width, zoomPoint[1] / gl.canvas.height)
    gl.uniform2f(zoomLocation, curZp[0] / gl.canvas.width, curZp[1] / gl.canvas.height)

    // Draw the rectangle.
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
    requestAnimationFrame(render);
}

function setRectangle(gl, x, y, width, height) {
    console.log('xywh', x, y, width, height)
    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ]), gl.STATIC_DRAW);
}

function setupTexture(gl, canvas, textureUnit, program, uniformName) {
    var tex = gl.createTexture();

    updateTextureFromCanvas(gl, tex, canvas, textureUnit);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var location = gl.getUniformLocation(program, uniformName);
    gl.uniform1i(location, textureUnit);
}

function updateTextureFromCanvas(gl, tex, canvas, textureUnit) {
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
}

function getZoomPoint(partSegmentation) {
    const nose = partSegmentation.pose.keypoints[0].position
    const leftEye = partSegmentation.pose.keypoints[1].position
    const rightEye = partSegmentation.pose.keypoints[2].position
    const amount = 1.5

    let cx = (leftEye.x + rightEye.x) / 2
    let cy = (leftEye.y + rightEye.y) / 2
    const deltaY = cy - nose.y
    cy = cy - deltaY * 2 * amount

    return [cx, cy]
}

function createPersonMask(multiPersonSegmentation, edgeBlurAmount) {
    var backgroundMaskImage = toMask(multiPersonSegmentation, { r: 0, g: 0, b: 0, a: 255 }, { r: 0, g: 0, b: 0, a: 0 }, false, [0, 1]);
    var backgroundMask = renderImageDataToOffScreenCanvas(backgroundMaskImage, CANVAS_NAMES.mask);
    if (edgeBlurAmount === 0) {
        return backgroundMask;
    }
    else {
        return drawAndBlurImageOnOffScreenCanvas(backgroundMask, edgeBlurAmount, CANVAS_NAMES.blurredMask);
    }
}

var CANVAS_NAMES = {
    blurred: 'blurred',
    blurredMask: 'blurred-mask',
    mask: 'mask',
    lowresPartMask: 'lowres-part-mask',
};


function getMaskImage(personSegmentation, edgeBlurAmount) {
    var personMask = createPersonMask(personSegmentation, edgeBlurAmount);
    return personMask
}


function toMask(personOrPartSegmentation, foreground, background, drawContour, foregroundIds) {
    // console.log('Foreground ids:', foregroundIds)
    if (foreground === void 0) {
        foreground = {
            r: 0,
            g: 0,
            b: 0,
            a: 0
        };
    }
    if (background === void 0) {
        background = {
            r: 0,
            g: 0,
            b: 0,
            a: 255
        };
    }
    if (drawContour === void 0) { drawContour = false; }
    if (foregroundIds === void 0) { foregroundIds = [0, 1]; }
    foregroundIds = [0, 1]
    if (Array.isArray(personOrPartSegmentation) &&
        personOrPartSegmentation.length === 0) {
        return null;
    }
    var multiPersonOrPartSegmentation;
    if (!Array.isArray(personOrPartSegmentation)) {
        multiPersonOrPartSegmentation = [personOrPartSegmentation];
    }
    else {
        multiPersonOrPartSegmentation = personOrPartSegmentation;
    }
    var _a = multiPersonOrPartSegmentation[0], width = _a.width, height = _a.height;
    var bytes = new Uint8ClampedArray(width * height * 4);
    function drawStroke(bytes, row, column, width, radius, color) {
        if (color === void 0) { color = { r: 0, g: 255, b: 255, a: 255 }; }
        for (var i = -radius; i <= radius; i++) {
            for (var j = -radius; j <= radius; j++) {
                if (i !== 0 && j !== 0) {
                    var n = (row + i) * width + (column + j);
                    bytes[4 * n + 0] = color.r;
                    bytes[4 * n + 1] = color.g;
                    bytes[4 * n + 2] = color.b;
                    bytes[4 * n + 3] = color.a;
                }
            }
        }
    }
    function isSegmentationBoundary(segmentationData, row, column, width, foregroundIds, radius) {
        if (foregroundIds === void 0) { foregroundIds = [1]; }
        if (radius === void 0) { radius = 1; }
        var numberBackgroundPixels = 0;
        for (var i = -radius; i <= radius; i++) {
            var _loop_2 = function (j) {
                if (i !== 0 && j !== 0) {
                    var n_1 = (row + i) * width + (column + j);
                    if (!foregroundIds.some(function (id) { return id === segmentationData[n_1]; })) {
                        numberBackgroundPixels += 1;
                    }
                }
            };
            for (var j = -radius; j <= radius; j++) {
                _loop_2(j);
            }
        }
        return numberBackgroundPixels > 0;
    }
    for (var i = 0; i < height; i += 1) {
        var _loop_1 = function (j) {
            var n = i * width + j;
            bytes[4 * n + 0] = background.r;
            bytes[4 * n + 1] = background.g;
            bytes[4 * n + 2] = background.b;
            bytes[4 * n + 3] = background.a;
            var _loop_3 = function (k) {
                if (foregroundIds.some(function (id) { return id === multiPersonOrPartSegmentation[k].data[n]; })) {
                    bytes[4 * n] = foreground.r;
                    bytes[4 * n + 1] = foreground.g;
                    bytes[4 * n + 2] = foreground.b;
                    bytes[4 * n + 3] = foreground.a;
                    var isBoundary = isSegmentationBoundary(multiPersonOrPartSegmentation[k].data, i, j, width, foregroundIds);
                    if (drawContour && i - 1 >= 0 && i + 1 < height && j - 1 >= 0 &&
                        j + 1 < width && isBoundary) {
                        drawStroke(bytes, i, j, width, 1);
                    }
                }
            };
            for (var k = 0; k < multiPersonOrPartSegmentation.length; k++) {
                _loop_3(k);
            }
        };
        for (var j = 0; j < width; j += 1) {
            _loop_1(j);
        }
    }
    return new ImageData(bytes, width, height);
}
function isSafari() {
    return (/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
}

function createOffScreenCanvas() {
    var offScreenCanvas = document.createElement('canvas');
    return offScreenCanvas;
}
function ensureOffscreenCanvasCreated(id) {
    if (!offScreenCanvases[id]) {
        offScreenCanvases[id] = createOffScreenCanvas();
    }
    return offScreenCanvases[id];
}
function drawAndBlurImageOnCanvas(image, blurAmount, canvas) {
    var height = image.height, width = image.width;
    var ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (isSafari()) {
        blur_1.cpuBlur(canvas, image, blurAmount);
    }
    else {
        ctx.filter = "blur(" + blurAmount + "px)";
        ctx.drawImage(image, 0, 0, width, height);
    }
    ctx.restore();
}
function drawAndBlurImageOnOffScreenCanvas(image, blurAmount, offscreenCanvasName) {
    var canvas = ensureOffscreenCanvasCreated(offscreenCanvasName);
    if (blurAmount === 0) {
        renderImageToCanvas(image, canvas);
    }
    else {
        drawAndBlurImageOnCanvas(image, blurAmount, canvas);
    }
    return canvas;
}
function renderImageToCanvas(image, canvas) {
    var width = image.width, height = image.height;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
}
function renderImageDataToCanvas(image, canvas) {
    canvas.width = image.width;
    canvas.height = image.height;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(image, 0, 0);
}
function renderImageDataToOffScreenCanvas(image, canvasName) {
    var canvas = ensureOffscreenCanvasCreated(canvasName);
    renderImageDataToCanvas(image, canvas);
    return canvas;
}




main();