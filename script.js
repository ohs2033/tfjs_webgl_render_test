import "@tensorflow/tfjs";
import * as faceapi from "face-api.js";
import Stats from "stats.js";
import Triangle from 'a-big-triangle'
import createShader from 'gl-shader'
import FragmentShader from './shader.frag';
import VertexShader from './shader.vert';
import * as bodyPix from '@tensorflow-models/body-pix';


var lightOverlay = 'light_overlay_v2.png'
var filterAlpha = 70

const stats = new Stats();
document.body.appendChild(stats.dom);

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const gl = canvas.getContext('webgl')

const dpr = window.devicePixelRatio;
gl.viewport(0, 0, video.width * dpr, video.height * dpr);
const shader = createShader(gl,
  VertexShader, FragmentShader
)
const detectorOptions = new faceapi.TinyFaceDetectorOptions();
var displaySize;

let net = null
var canvas1 = document.createElement("canvas");
var getFrameImage = async function (callback) {
  canvas1.getContext('2d')
    .drawImage(video, 0, 0, canvas1.width, canvas1.height);
  var img = document.createElement("img")
  img.id = 'image1';
  img.src = canvas1.toDataURL();
  callback(img)
};

var drawPixel = async (img) => {
  if (net === null) {
    net = await bodyPix.load(/** optional arguments, see below **/);
  }
  const partSegmentation = await net.segmentPersonParts(img);
  const coloredPartImage = bodyPix.toColoredPartMask(partSegmentation);

  const opacity = 0.7;
  const flipHorizontal = false;
  const maskBlurAmount = 0;
  const pixelCellWidth = 10.0;
  // Draw the pixelated colored part image on top of the original image onto a
  // canvas.  Each pixel cell's width will be set to 10 px. The pixelated colored
  // part image will be drawn semi-transparent, with an opacity of 0.7, allowing
  // for the original image to be visible under.
  bodyPix.drawPixelatedMask(
    canvas1, img, coloredPartImage, opacity, maskBlurAmount,
    flipHorizontal, pixelCellWidth);
}
const main = async () => {

  var slider = document.getElementById("filter-alpha");
  var output = document.getElementById("alpha-meter");
  output.innerHTML = slider.value;

  slider.oninput = function () {
    filterAlpha = this.value
    output.innerHTML = `alpha : ${filterAlpha}`
  }

  // await faceapi.loadTinyFaceDetectorModel("models");
  // const animate = async () => {
  // stats.begin();
  // updateTexture(gl, video)
  // render();

  // const detection = await faceapi.detectSingleFace(video, detectorOptions);
  // console.log(detection)
  // if (detection) {
  //   const { topLeft, bottomRight } = detection.relativeBox
  //   shader.uniforms.top = topLeft.y;
  //   shader.uniforms.left = topLeft.x;
  //   shader.uniforms.bottom = bottomRight.y;
  //   shader.uniforms.right = bottomRight.x;
  //   console.log(shader.uniforms)
  // }

  // stats.end();
  //   requestAnimationFrame(animate);
  // };

  const onLoadedData = () => {
    initTexture(gl, 0);

    getImage().then(() => { //light overlay 이미지

      video.play();
      requestAnimationFrame(animate);
    })
  };

  displaySize = { width: video.width, height: video.height };
  video.addEventListener("loadeddata", onLoadedData);
};

const animate = async () => {
  stats.begin();

  // updateTexture(gl, video)
  // render();
  await getFrameImage(drawPixel)
  // const detection = await faceapi.detectSingleFace(video, detectorOptions);
  // console.log(detection)
  // if (detection) {
  //   const { topLeft, bottomRight } = detection.relativeBox
  //   shader.uniforms.top = topLeft.y;
  //   shader.uniforms.left = topLeft.x;
  //   shader.uniforms.bottom = bottomRight.y;
  //   shader.uniforms.right = bottomRight.x;
  //   console.log(shader.uniforms)

  stats.end();
  requestAnimationFrame(animate);
};

function render() {
  shader.bind()
  shader.uniforms.lightTexture = 1
  shader.uniforms.uTexture = 0
  shader.uniforms.filterAlpha = filterAlpha / 100
  Triangle(gl)
}


function initTexture(gl, unit) {
  const texture = gl.createTexture();
  bindTexture(gl, texture, unit)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture;
}

function updateTexture(gl, screen) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
    srcFormat, srcType, screen);
}

function bindTexture(gl, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
}

function getImage() {
  return new Promise(resolve => {
    var image = new Image()
    image.src = lightOverlay
    image.onload = () => {
      initTexture(gl, 1)
      updateTexture(gl, image)
      gl.activeTexture(gl.TEXTURE0)
      resolve()
    }
  })
}

main();
