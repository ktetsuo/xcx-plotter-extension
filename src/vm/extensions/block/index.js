import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
import blockIcon from './block-icon.png';
const Clone = require('../../util/clone');
const TargetType = require('../../extension-support/target-type');

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

        runtime.on('targetWasCreated', this._onTargetCreated);
        runtime.on('RUNTIME_DISPOSED', this.clear.bind(this));

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }
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
                }
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
