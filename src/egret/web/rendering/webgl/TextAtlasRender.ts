//////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (c) 2014-present, Egret Technology.
//  All rights reserved.
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Egret nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY EGRET AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
//  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL EGRET AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;LOSS OF USE, DATA,
//  OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//////////////////////////////////////////////////////////////////////////////////////

namespace egret.web {

    //测试开关
    export const textAtlasRenderEnable: boolean = true;
    //测试对象
    export let __textAtlasRender__: TextAtlasRender = null;
    //不想改TextNode的代码了，先用这种方式实现
    export const property_drawLabel = 'DrawLabel';

    //画一行
    export class DrawLabel extends HashObject {

        private static pool: DrawLabel[] = [];

        public anchorX: number = 0;
        public anchorY: number = 0;
        public textBlocks: TextBlock[] = [];

        private clear(): void {
            this.anchorX = 0;
            this.anchorY = 0;
            this.textBlocks.length = 0; //这个没事,实体在book里面存着
        }

        public static create(): DrawLabel {
            const pool = DrawLabel.pool;
            if (pool.length === 0) {
                pool.push(new DrawLabel);
            }
            return pool.pop();
        }

        public static back(drawLabel: DrawLabel, checkRepeat: boolean): void {
            if (!drawLabel) {
                return;
            }
            const pool = DrawLabel.pool;
            if (checkRepeat && pool.indexOf(drawLabel) >= 0) {
                console.error('DrawLabel.back repeat');
                return;
            }
            drawLabel.clear();
            pool.push(drawLabel);
        }
    }

    //
    class StyleKey extends HashObject {

        public readonly textColor: number;
        public readonly strokeColor: number;
        public readonly size: number;
        public readonly stroke: number;
        public readonly bold: boolean;
        public readonly italic: boolean;
        public readonly fontFamily: string;
        public readonly font: string;
        public readonly format: sys.TextFormat = null;
        public readonly $canvasScaleX: number;
        public readonly $canvasScaleY: number;
        public readonly description: string;

        constructor(textNode: sys.TextNode, format: sys.TextFormat) {
            super();
            //
            this.textColor = textNode.textColor;
            this.strokeColor = textNode.strokeColor;
            this.size = textNode.size;
            this.stroke = textNode.stroke;
            this.bold = textNode.bold;
            this.italic = textNode.italic;
            this.fontFamily = textNode.fontFamily;
            this.format = format;
            this.font = getFontString(textNode, this.format);
            this.$canvasScaleX = parseFloat(textNode.$canvasScaleX.toFixed(2)); //不搞那么长
            this.$canvasScaleY = parseFloat(textNode.$canvasScaleY.toFixed(2));
            //
            this.description = '' + this.font;
            const textColor = format.textColor == null ? textNode.textColor : format.textColor;
            const strokeColor = format.strokeColor == null ? textNode.strokeColor : format.strokeColor;
            const stroke = format.stroke == null ? textNode.stroke : format.stroke;
            this.description += '-' + toColorString(textColor);
            this.description += '-' + toColorString(strokeColor);
            if (stroke) {
                this.description += '-' + stroke * 2;
            }
            this.description += '-' + this.$canvasScaleX;
            this.description += '-' + this.$canvasScaleY;
        }
    }

    class CharImage extends HashObject {
        //
        public _char: string = '';
        public _styleKey: StyleKey = null;
        public _string: string = '';
        public _hashCode: number = 0;
        public measureWidth: number = 0;
        public measureHeight: number = 0;

        //针对中文的加速查找
        private static readonly __chineseCharactersRegExp__ = new RegExp("^[\u4E00-\u9FA5]$");
        private static readonly __chineseCharacterMeasureFastMap__: { [index: string]: TextMetrics } = {};

        public reset(char: string, styleKey: StyleKey): CharImage {
            this._char = char;
            this._styleKey = styleKey;
            this._string = char + ':' + styleKey.description;
            this._hashCode = NumberUtils.convertStringToHashCode(this._string);
            return this;
        }

        public get renderWidth(): number {
            return this.measureWidth * this._styleKey.$canvasScaleX;
        }

        public get renderHeight(): number {
            return this.measureHeight * this._styleKey.$canvasScaleY;
        }

        public measureTextAndDrawToCanvas(canvas: HTMLCanvasElement): void {
            if (!canvas) {
                return;
            }
            //
            const text = this._char;
            const format: sys.TextFormat = this._styleKey.format;
            const textColor = format.textColor == null ? this._styleKey.textColor : format.textColor;
            const strokeColor = format.strokeColor == null ? this._styleKey.strokeColor : format.strokeColor;
            const stroke = format.stroke == null ? this._styleKey.stroke : format.stroke;
            //
            const context = egret.sys.getContext2d(canvas);
            //Step1: 重新测试字体大小
            const measureText = this.measureText(context, text, this._styleKey.font);
            if (measureText) {
                this.measureWidth = measureText.width;
                this.measureHeight = this._styleKey.size;
            }
            else {
                console.error('text = ' + text + ', measureText is null');
                this.measureWidth = this._styleKey.size;
                this.measureHeight = this._styleKey.size;
            }
            //
            canvas.width = this.renderWidth;
            canvas.height = this.renderHeight;
            //再开始绘制
            context.save();
            context.textAlign = 'left';
            context.textBaseline = 'top';
            context.lineJoin = 'round';
            context.font = this._styleKey.font;
            context.fillStyle = toColorString(textColor);
            context.strokeStyle = toColorString(strokeColor);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.translate(0, 0);
            context.scale(this._styleKey.$canvasScaleX, this._styleKey.$canvasScaleY);
            //
            if (stroke) {
                context.lineWidth = stroke * 2;
                context.strokeText(text, 0, 0);
            }
            context.fillText(text, 0, 0);
            context.restore();
        }

        private measureText(context: CanvasRenderingContext2D, text: string, font: string): TextMetrics {
            const isChinese = CharImage.__chineseCharactersRegExp__.test(text);
            if (isChinese) {
                if (CharImage.__chineseCharacterMeasureFastMap__[font]) {
                    return CharImage.__chineseCharacterMeasureFastMap__[font];
                }
            }
            context.font = font;
            const measureText = context.measureText(text);
            if (isChinese) {
                CharImage.__chineseCharacterMeasureFastMap__[font] = measureText;
            }
            return measureText;
        }
    }

    //
    export class TextAtlasRender extends HashObject {

        //
        private readonly book = new Book(512, 1);
        private readonly charImage = new CharImage;
        private readonly textBlockMap: { [index: number]: TextBlock } = {};
        private _canvas: HTMLCanvasElement = null;
        private readonly textAtlasTextureCache: WebGLTexture[] = [];
        private readonly webglRenderContext: WebGLRenderContext = null;

        //
        constructor(webglRenderContext: WebGLRenderContext, maxSize: number, border: number) {
            super();
            this.webglRenderContext = webglRenderContext;
            this.book = new Book(maxSize, border);
        }

        public static analysisTextNode(textNode: sys.TextNode): void {
            if (!textNode) {
                return;
            }

            if (!__textAtlasRender__) {
                const webglcontext = egret.web.WebGLRenderContext.getInstance(0, 0);
                __textAtlasRender__ = new TextAtlasRender(webglcontext, webglcontext.$maxTextureSize, 1);
            }

            //清除命令
            textNode[property_drawLabel] = textNode[property_drawLabel] || [];
            let drawLabels = textNode[property_drawLabel] as DrawLabel[];
            for (const drawLabel of drawLabels) {
                DrawLabel.back(drawLabel, false);
            }
            drawLabels.length = 0;
            //重新装填
            const offset = 4;
            const drawData = textNode.drawData;
            let anchorX = 0;
            let anchorY = 0;
            let labelString = '';
            let format: sys.TextFormat = {};
            let renderTextBlocks: TextBlock[] = [];
            for (let i = 0, length = drawData.length; i < length; i += offset) {
                anchorX = drawData[i + 0] as number;
                anchorY = drawData[i + 1] as number;
                labelString = drawData[i + 2] as string;
                format = drawData[i + 3] as sys.TextFormat || {};
                renderTextBlocks.length = 0;
                //提取数据
                __textAtlasRender__.convertLabelStringToTextAtlas(labelString, new StyleKey(textNode, format), renderTextBlocks);
                //添加命令
                const drawLabel = DrawLabel.create();//new DrawLabel;
                drawLabel.anchorX = anchorX;
                drawLabel.anchorY = anchorY;
                drawLabel.textBlocks = [].concat(renderTextBlocks);
                drawLabels.push(drawLabel);
            }
        }

        public convertLabelStringToTextAtlas(labelstring: string, styleKey: StyleKey, renderTextBlocks: TextBlock[]): void {
            const canvas = this.canvas;
            const $charValue = this.charImage;
            const textBlockMap = this.textBlockMap;
            for (const char of labelstring) {
                //不反复创建
                $charValue.reset(char, styleKey);
                if (textBlockMap[$charValue._hashCode]) {
                    //检查重复
                    renderTextBlocks.push(textBlockMap[$charValue._hashCode]);
                    continue;
                }
                //尝试渲染到canvas
                $charValue.measureTextAndDrawToCanvas(canvas);
                //console.log(char + ':' + canvas.width + ', ' + canvas.height);
                //创建新的文字块
                const txtBlock = this.book.createTextBlock($charValue.renderWidth, $charValue.renderHeight, $charValue.measureWidth, $charValue.measureHeight);
                if (!txtBlock) {
                    continue;
                }
                //
                textBlockMap[$charValue._hashCode] = txtBlock;
                txtBlock.tag = char;
                renderTextBlocks.push(txtBlock);
                //
                const page = txtBlock.page;
                page.webGLTexture = page.webGLTexture || this.createTextTextureAtlas(page.pageWidth, page.pageHeight);
                const textAtlas = page.webGLTexture;
                const gl = this.webglRenderContext.context;
                gl.bindTexture(gl.TEXTURE_2D, textAtlas);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, txtBlock.subImageOffsetX, txtBlock.subImageOffsetY, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            }
        }

        private createTextTextureAtlas(width: number, height: number): WebGLTexture {
            const texture = egret.sys._createTexture(this.webglRenderContext, width, height, null);
            if (texture) {
                this.textAtlasTextureCache.push(texture);
            }
            return texture;
        }

        private get canvas(): HTMLCanvasElement {
            if (!this._canvas) {
                this._canvas = egret.sys.createCanvas(24, 24);
            }
            return this._canvas;
        }
    }
}
