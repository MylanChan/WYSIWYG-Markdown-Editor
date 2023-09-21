import React, {RefObject} from "react";
import {MDparser} from "./parser";
import {Editor} from "./Editor";

function compareBaseExtendPos(focus, anchor) {
    if (focus.idx === anchor.idx || focus.idx < anchor.idx) {
        return [focus, anchor]
    }
    return [anchor, focus]
}


export class EditorPanel extends React.Component<any, any> {
    private ref: RefObject<HTMLDivElement>;
    private MDparser = new MDparser();

    constructor(props) {
        super(props);
        this.state = {blocks: [""], undo: []};
        this.ref = React.createRef();
    }
    
    private handleCompositionEnd(event) {
        const blockElements = [...event.target.childNodes]

        const focus = Editor.Block.info(window.getSelection().focusNode);
        
        let undo = [...this.state.undo];
        undo.push({blocks: [...this.state.blocks], focus: this.state.focus})

        this.setState({
            blocks: blockElements.map(e=>e.textContent),
            focus: {index: focus.idx, offset: focus.offset},
            anchor: null,
            undo
        })
    }

    private handlePasteDrop(event) {
        event.preventDefault();
        const {blocks} = this.state;
        const focus = Editor.Block.info(event.target);

        let state:any = {};

        state.undo = [...this.state.undo];
        state.undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

        let data: String[];
        if (event.nativeEvent instanceof ClipboardEvent) {
            data = event.clipboardData.getData("Text").split(/\r?\n/);
        }
        else if (event.nativeEvent instanceof DragEvent) {
            data = event.dataTransfer.getData("Text").split(/\r?\n/);
        }

        data[0] = focus.element.textContent + data[0];

        state.blocks = Editor.Object.splice(blocks, focus.idx, 1, ...data);
        
        state.focus = {index: data.length-focus.idx-1, offset: data.at(-1).length};
        state.anchor = null;

        return this.setState(state);
    }

    private handleClick(event) {
        // IMPORTANT
        // event.target is not same as window.getSelection().focusNode
        // To be conventional, use focusNode instead
        const {focusNode, focusOffset} = window.getSelection();
        if (event.target.nodeType === 1 || event.target.tagName === "INPUT") return;
        
        if (window.getSelection().type === "Range") return;

        if (focusNode.nodeType === 1) {
            if ((focusNode as HTMLElement).classList.contains("editor") || focusNode.parentElement.classList.contains("editor")) return
        }

        const {element, index} = Editor.Element.getTopNodeFromParent(document.querySelector(".editor"), focusNode)

        this.setState({
            focus: {
                index: index,
                offset: Editor.Caret.offsetAtParentTextContent(element, focusNode, focusOffset)
            },
            anchor: null
        })
    }

    private handleKeyDown(event) {
        const {blocks} = this.state;
        
        const {type, focusNode, anchorNode, anchorOffset} = window.getSelection();

        if (focusNode.nodeType === 1 && (focusNode as HTMLElement).classList.contains("editor")) return;

        const focus = Editor.Block.info(focusNode);
        const anchor = Editor.Block.info(anchorNode, anchorOffset);

        if (event.key.length === 1 && !event.ctrlKey) {
            event.preventDefault();
            
            let undo = [...this.state.undo];
            undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

            const [earlier, later] = compareBaseExtendPos(focus, anchor)
            
            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + event.key + blocks[later.idx].slice(later.offset)

            this.setState({
                blocks: Editor.Object.splice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt),
                focus: {index: earlier.idx, offset: earlier.offset+1},
                anchor: null,
                undo: undo
            })
            return;
        }
        switch (event.key) {
        case "a": {
            if (event.ctrlKey) {
                event.preventDefault();
                this.setState({
                    focus: {index: 0, offset: 0},
                    anchor: {index: blocks.length-1, offset: blocks.at(-1).length}
                });
            }
            return;
        }
        case "z": {
            if (event.ctrlKey) {
                event.preventDefault();
                this.setState({
                    ...this.state.undo.at(-1),
                    undo: Editor.Object.splice(this.state.undo, this.state.undo.length-1, 1)
                })
            }
            return;
        }
        case "ArrowLeft": {
            event.preventDefault();
            
            let state: any = {};
            state.anchor = event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null; 
            
            if (type === "Range" && !event.shiftKey) {
                const [earlier,] = compareBaseExtendPos(focus, anchor)
                
                state.focus = {index: earlier.idx, offset: earlier.offset};
                return this.setState(state);
            }
            if (focus.offset === 0) {
                if (focus.idx === 0) return;
                
                state.focus = {index: focus.idx-1, offset: focus.prev().len};
                return this.setState(state);
            }

            state.focus = {index: focus.idx, offset: focus.offset-1};

            return this.setState(state);
        }
        case "ArrowRight": {
            event.preventDefault();
            
            let state: any = {};
            state.anchor = event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null;

            if (type === "Range" && !event.shiftKey) {
                const [, later] = compareBaseExtendPos(focus, anchor);
                
                state.focus = {index: later.idx, offset: later.offset};
                return this.setState(state);
            }
            
            if (focus.offset === focus.len) {
                if (focus.idx === this.ref.current.childNodes.length-1) return
                
                state.focus = {index: focus.idx+1, offset: 0};
                return this.setState(state);
            }

            state.focus = {index: focus.idx, offset: focus.offset+1};
            return this.setState(state);
        }
        case "ArrowUp": {
            event.preventDefault();
            
            let state: any = {};
            state.anchor = event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null;

            if (focus.idx === 0) {
                state.focus = {index: focus.idx, offset: 0};
                return this.setState(state);
            }

            state.focus = {index: focus.idx-1, offset: this.state.focus.offset};
            return this.setState(state);
        }
        case "ArrowDown": {
            event.preventDefault();
           
            let state: any = {};
            state.anchor = event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null;

            if (focus.idx === event.target.childNodes.length - 1) {
                state.focus = {index: focus.idx, offset: focus.len};
                return this.setState(state);
            }

            state.focus = {index: focus.idx+1, offset: this.state.focus.offset};
            return this.setState(state);
        }
        case "Enter": {
            event.preventDefault();

            let undo = [...this.state.undo];
            undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

            const [earlier, later] = compareBaseExtendPos(focus, anchor)
                
            const replaceElt = [
                blocks[earlier.idx].slice(0, earlier.offset), blocks[later.idx].slice(later.offset)
            ]
            this.setState({
                blocks: Editor.Object.splice(blocks, earlier.idx, later.idx-earlier.idx+1, ...replaceElt),
                focus: {index: earlier.idx+1, offset: 0},
                anchor: null,
                undo: undo
            });

            return;
        }
        case "Backspace": {
            event.preventDefault();

            let state: any = {anchor: null, undo: [...this.state.undo]};
            state.undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

            if (type === "Caret") {
                if (focusNode.nodeType === 1 && focus.offset === 0) {
                    if (focus.idx === 0) return;
                    
                    const replaceElt = blocks[focus.idx-1]+blocks[focus.idx];
                    state.blocks = Editor.Object.splice(blocks, focus.idx-1, 2, replaceElt);

                    state.focus = {index: focus.idx-1, offset: focus.prev().len};
                    return this.setState(state);
                }
                
                const replaceElt = Editor.Object.splice(blocks[focus.idx], focus.offset-1, 1);
                state.blocks = Editor.Object.splice(blocks, focus.idx, 1, replaceElt);

                state.focus = {index: focus.idx, offset: focus.offset-1}; 
                return this.setState(state);
            } 

            const [earlier, later] = compareBaseExtendPos(focus, anchor)
            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + blocks[later.idx].slice(later.offset)
            state.blocks = Editor.Object.splice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt);

            state.focus = {index: earlier.idx, offset: earlier.offset};
            return this.setState(state);
        }
        case "Delete": {
            let state: any = {anchor: null, undo: [...this.state.undo]};

            if (type === "Caret") {
                if (focus.offset === focus.len && blocks[focus.idx+1]) {
                    state.blocks = Editor.Object.splice(blocks, focus.idx, 2, blocks[focus.idx]+blocks[focus.idx+1]);
                    
                    state.focus = {index: focus.idx, offset: focus.offset};
                    return this.setState(state);
                }

                state.blocks = Editor.Object.splice(blocks, focus.idx, 1, Editor.Object.splice(blocks[focus.idx], focus.offset, 1));
                
                state.focus = {index: focus.idx, offset: focus.offset};
                return this.setState(state);
            }

            const [earlier, later] = compareBaseExtendPos(focus, anchor)

            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + blocks[later.idx].slice(later.offset)
            state.blocks = Editor.Object.splice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt);
            
            state.focus = {index: earlier.idx, offset: earlier.offset}
            return this.setState(state);
        }
        }
    }

    private handleSelect(event) {
        if (event.nativeEvent instanceof MouseEvent) {

            const {focusNode, anchorNode, anchorOffset} = window.getSelection();
            
            if (focusNode.nodeType === 1 && (focusNode as HTMLElement).classList.contains("editor")) return;

            const focus = Editor.Block.info(focusNode);
            const anchor = Editor.Block.info(anchorNode, anchorOffset);

            this.setState({
                focus: {index: focus.idx, offset: focus.offset},
                anchor: {index: anchor.idx, offset: anchor.offset}
            })
        }
    }

    componentDidUpdate() {
        let {focus, anchor} = this.state
        if (!focus) focus = {index: 0, offset: 0};

        const blockElts = this.ref.current.childNodes;

        const focusSel = Editor.Caret.nodeAtParentTextOffset(blockElts[focus.index], focus.offset);

        const detectActSiblings = (sel) => {
            if (sel.node.nodeType === 1) return [sel.node];

            const styleParent = Editor.Element.farthest(sel.node, ".style");

            const offset = Editor.Caret.offsetAtParentTextContent(styleParent, sel.node, sel.offset);

            const side = Editor.Caret.isOnNodeSide(styleParent, offset);

            let act = [styleParent];
            if (side.left && styleParent.previousSibling) act.push(styleParent.previousSibling);

            if (side.right && styleParent.nextSibling) act.push(styleParent.nextSibling);

            return act
        }

        let active = [];

        if (anchor) {
            const anchorSel = Editor.Caret.nodeAtParentTextOffset(blockElts[anchor.index], anchor.offset);
            Editor.Caret.createRange(focusSel, anchorSel);
            active.push(...detectActSiblings(anchorSel));
        }
        else {
            Editor.Caret.createRange(focusSel)
        }

        for (let i=Math.min(focus.index, anchor?.index); i<=Math.max(focus.index, anchor?.index); i++) {
            for (let child of this.ref.current.childNodes[i].childNodes) {
                if (window.getSelection().containsNode(child, true)) {
                    active.push(child)
                }       
            }
        } 
        
        active.push(...detectActSiblings(focusSel));

        for (let element of document.querySelectorAll(".act")) {
            if (!active.includes(element)) {
                element.classList.remove("act")
            } else {
                active.splice(active.findIndex(e=>e===element), 1)
            }
        }
        active.forEach(elt => elt.classList.add("act"))

    }
    
    render() {
        return (
            <>
    
            <div
                ref={this.ref}
                contentEditable
                suppressContentEditableWarning
    
                className="editor"
    
                onKeyDown={this.handleKeyDown.bind(this)}
                onCompositionEnd={this.handleCompositionEnd.bind(this)}
                onPaste={this.handlePasteDrop.bind(this)}
                onClick={this.handleClick.bind(this)}
                onDrop={this.handlePasteDrop.bind(this)}
                onSelect={this.handleSelect.bind(this)}
            >
                {this.MDparser.parser(this.state.blocks.join("\n"))}
            </div>
            </>
        )
    }
}
