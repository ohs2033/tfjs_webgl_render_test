////////////////// draw image ///////////////////

attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    // vec2 clipSpace = a_position;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

    // 그대로 넘겨주기.. GPU가 점 사이를 interpolate할 것이다.
    v_texCoord = a_texCoord;

}
