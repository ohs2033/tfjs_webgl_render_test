precision mediump float;

// texture
uniform sampler2D u_image;
uniform sampler2D u_image2;

uniform vec2 zoom_point;
uniform float zoom_value;

// vertex shader 에서 전달된 texCoords
varying vec2 v_texCoord;

void main() {
    // Fragment shader 에 texCoord전달
    // GPU는 이 value를 점들 사이에 삽입.
    vec4 color1 = texture2D(u_image, v_texCoord*0.8+zoom_point*0.2);
    vec4 color2 = texture2D(u_image2, v_texCoord*0.8+zoom_point*0.2);
    vec4 color3 = vec4(color2.rgb, color1.a*color2.a);

    vec4 color4 = texture2D(u_image, v_texCoord);
    vec4 color5 = texture2D(u_image2, v_texCoord);
    vec4 color6 = vec4(color5.rgb, ((color1.a-1.0)*(-1.0))*color5.a);
    if(color3.a == 1.0) {
        gl_FragColor = color3; 
    } else if (color6.a == 1.0) {
        gl_FragColor = color6;
    } else {
        gl_FragColor = vec4(color6.rgb*color6.a + color3.rgb*color3.a, 1.0);
    } 
}
