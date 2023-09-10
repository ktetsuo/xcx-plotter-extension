import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
import blockIcon from './block-icon.png';
import Clone from '../../util/clone';
import TargetType from '../../extension-support/target-type';

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.defaultMessage;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'plotterExtention';

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://ktetsuo.github.io/xcx-plotter-extension/dist/plotterExtention.mjs';

class Rect {
    constructor (minX, minY, maxX, maxY) {
        this._minX = minX;
        this._minY = minY;
        this._maxX = maxX;
        this._maxY = maxY;
    }
    get width () {
        return this._maxX - this._minX;
    }
    get height () {
        return this._maxY - this._minY;
    }
    get minX () {
        return this._minX;
    }
    get minY () {
        return this._minY;
    }
    get maxX () {
        return this._maxX;
    }
    get maxY () {
        return this._maxY;
    }
}

/**
 * Scratch 3.0 blocks for example of Xcratch.
 */
class ExtensionBlocks {
    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'plotterExtention.name',
            default: 'Plotter Extention',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for Plotter Extention.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        this.isPenDown = false;
        this._onTargetCreated = this._onTargetCreated.bind(this);
        this._onTargetMoved = this._onTargetMoved.bind(this);
        this._penDrawableId = -1;
        this._penSkinId = -1;
        this._actionBuf = [];
        this._plotAreaMM = new Rect(0, 0, 160, 120);
        runtime.on('targetWasCreated', this._onTargetCreated);
        runtime.on('RUNTIME_DISPOSED', this.clear.bind(this));

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }
    }

    static get SCRATCH_AREA () {
        return new Rect(-240, -180, 240, 180);
    }

    static get MM_PER_PLOT () {
        return 0.025; // mm/plot
    }

    static get PLOT_PER_MM() {
        return 40; // plot/mm
    }

    static get STATE_KEY () {
        return 'Scratch.pen';
    }

    static get DEFAULT_PEN_STATE () {
        return {
            penDown: false,
            color: 66.66,
            saturation: 100,
            brightness: 100,
            transparency: 0,
            _shade: 50, // Used only for legacy `change shade by` blocks
            penAttributes: {
                color4f: [0, 0, 1, 1],
                diameter: 1
            }
        };
    }
    _getPenState (target) {
        let penState = target.getCustomState(ExtensionBlocks.STATE_KEY);
        if (!penState) {
            penState = Clone.simple(ExtensionBlocks.DEFAULT_PEN_STATE);
            target.setCustomState(ExtensionBlocks.STATE_KEY, penState);
        }
        return penState;
    }
    _getPenLayerID () {
        if (this._penSkinId < 0 && this.runtime.renderer) {
            this._penSkinId = this.runtime.renderer.createPenSkin();
            this._penDrawableId = this.runtime.renderer.createDrawable('pen');
            this.runtime.renderer.updateDrawableSkinId(this._penDrawableId, this._penSkinId);
        }
        return this._penSkinId;
    }

    _scratchPosToCmdPos (scratchPos) {
        return {
            x: (scratchPos.y - ExtensionBlocks.SCRATCH_AREA.minY) * this._plotAreaMM.height / ExtensionBlocks.SCRATCH_AREA.height * ExtensionBlocks.PLOT_PER_MM,
            y: (scratchPos.x - ExtensionBlocks.SCRATCH_AREA.minX) * this._plotAreaMM.width / ExtensionBlocks.SCRATCH_AREA.width * ExtensionBlocks.PLOT_PER_MM,
        };
    }

    _onTargetMoved (target, oldX, oldY, isForce) {
        console.log("_onTargetMoved (%d,%d) -> (%d,%d)", oldX, oldY, target.x, target.y);
        if (isForce) {
            console.log("force");
            return;
        }
        const penState = this._getPenState(target);
        const penSkinId = this._getPenLayerID();
        this.runtime.renderer.penLine(penSkinId, penState.penAttributes, oldX, oldY, target.x, target.y);
        this.runtime.requestRedraw();
        const cmdPos = this._scratchPosToCmdPos(target);
        this._actionBuf.push('PD' + cmdPos.x.toFixed().toString() + ',' + cmdPos.y.toFixed().toString() + ';');
        console.log(this._actionBuf.join(''));
    }

    _onTargetCreated (newTarget, sourceTarget) {
        if (sourceTarget) {
            const penState = sourceTarget.getCustomState(Scratch3PenBlocks.STATE_KEY);
            if (penState) {
                newTarget.setCustomState(ExtensionBlocks.STATE_KEY, Clone.simple(penState));
                if (penState.penDown) {
                    // newTarget.addListener(RenderedTarget.EVENT_TARGET_MOVED, this._onTargetMoved);
                    newTarget.addListener("TARGET_MOVED", this._onTargetMoved);
                }
            }
        }
    }

    clear () {
        console.log("Clear");
        this._actionBuf.splice(0);
        const penSkinId = this._getPenLayerID();
        if (penSkinId >= 0) {
            this.runtime.renderer.penClear(penSkinId);
            this.runtime.requestRedraw();
        }
    }

    penDown (args, util) {
        console.log("PenDown");
        const target = util.target;
        if (!this.isPenDown) {
            console.log("addListener");
            this.isPenDown = true;
            // target.addListener(RenderedTarget.EVENT_TARGET_MOVED, this._onTargetMoved);
            target.addListener('TARGET_MOVED', this._onTargetMoved);
            const cmdPos = this._scratchPosToCmdPos(target);
            this._actionBuf.push('PU' + cmdPos.x.toFixed().toString() + ',' + cmdPos.y.toFixed().toString() + ';');
            this._actionBuf.push('PD;');
            console.log(this._actionBuf.join(''));
        }
    }

    penUp (args, util) {
        console.log("PenUp");
        const target = util.target;
        if (this.isPenDown) {
            console.log("removeListener");
            this.isPenDown = false;
            // target.removeListener(RenderedTarget.EVENT_TARGET_MOVED, this._onTargetMoved);
            target.removeListener('TARGET_MOVED', this._onTargetMoved);
            this._actionBuf.push('PU;');
            console.log(this._actionBuf.join(''));
        }
    }

    post (args, util) {
        console.log("Post");
        const target = util.target;
        if (this._actionBuf.length > 0) {
            const body = this._actionBuf.join('');
            console.log(body);
            const pr = fetch(args.URL, { method: 'POST', body: body });
        }
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: ExtensionBlocks.EXTENSION_ID,
            name: ExtensionBlocks.EXTENSION_NAME,
            extensionURL: ExtensionBlocks.extensionURL,
            blockIconURI: blockIcon,
            showStatusButton: false,
            blocks: [
                {
                    opcode: 'clear',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'plotterExtention.clear',
                        default: 'clear',
                        description: 'clear'
                    }),
                    func: 'clear',
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'pen-down',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'plotterExtention.penDown',
                        default: 'pen down',
                        description: 'pen down'
                    }),
                    func: 'penDown',
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'pen-up',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'plotterExtention.penUp',
                        default: 'pen up',
                        description: 'pen up'
                    }),
                    func: 'penUp',
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'post',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'plotterExtention.post',
                        default: 'post to [URL]',
                        description: 'HTTP POST'
                    }),
                    func: 'post',
                    arguments: {
                        URL: {
                            type: ArgumentType.STRING,
                            defaultValue: 'http://localhost:1880/plotter'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
            ],
            menus: {
            }
        };
    }
}

export {
    ExtensionBlocks as default,
    ExtensionBlocks as blockClass
};
