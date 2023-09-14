import React, {StrictMode} from "react";
import ReactDOM from "react-dom/client";
import {parser} from "./parser";

function compareBaseExtendPos(focus, anchor) {
    if (focus.idx === anchor.idx) {
        if (focus.offset < anchor.offset) {
            return [focus, anchor]
        } else {
            return [anchor, focus]
        }
    } else {
        if (focus.idx < anchor.idx) {
            return [focus, anchor]
        } else {
            return [anchor, focus]
        }
    }
}

function getTopStyleElt(child) {
    if (!child.parentElement.tagName) return null

    if (child.parentElement.parentElement.classList.contains("editor")) {
        return child
    } else {
        return getTopStyleElt(child.parentElement)
    }
}

function arraySplice(array, ...args) {
    array.splice(...args)
    return array;
}

function strSplice(str, ...args) {
    let strList = str.split("");
    return arraySplice(strList, ...args).join("");
}

function getBlockAllInfo(node, offset=window.getSelection().focusOffset) {
    const editor = document.querySelector(".editor");
    const {blockElement, index} = getFocusBlockIdx(editor, node);
    return {
        parent: () => {
            return {
                children: editor,
                nChild: editor.childNodes.length
            }
        },
        element: blockElement,
        offset: calParentOffset(blockElement, node, offset),
        idx: index,
        len: blockElement.textContent.length,
        prev: index > 0 ? getBlockAllInfo(blockElement.previousSibling): null
    }
}

/**
 * @param {{Node, number}} focus
 * @param {{Node, number}} anchor
 */
function createRange(focus, anchor=null) {
    const selection = window.getSelection();
    
    if (anchor) {
        selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset)
    } else {
        selection.setPosition(focus.node, focus.offset)
    }
}

function calParentOffset(parentElement, child, focusOffset=0) {
    let offset = 0
    if (parentElement === child) return focusOffset
    if (parentElement.nodeType === 3) return 0

    if (focusOffset) offset += focusOffset
    for (let element of [...parentElement.childNodes]) {
        if (element.contains(child)) {
            return offset += calParentOffset(element, child);
        } else {
            offset += element.textContent.length
        }
    }
}

function offsetFromParent(parentElement, offset) {
    if (parentElement === undefined) return;
    // at the start of paragraph
    if (parentElement.nodeType === 1 && offset === 0) {
        return {node: parentElement, offset: 0}
    }

    // if offset exceed the maximum offset of parent element
    // it should return and locate caret at the last offset
    if (offset > parentElement.textContent.length) {
        return offsetFromParent(parentElement, parentElement.textContent.length)
    }

    if (parentElement.nodeType === 3) return {node: parentElement, offset: offset};

    for (let child of [...parentElement.childNodes]) {
        if (offset <= child.textContent.length) {
            return offsetFromParent(child, offset);
        } else {
            offset -= child.textContent.length
        }
    }

    return {node: null, offset: null}
}

function getFocusBlockIdx(parentElement, child) {
    for (let [index, blockElement] of parentElement.childNodes.entries()) {
        if (blockElement.contains(child)) {
            return {blockElement, index}
        }
    }
}

class Suture extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            blocks: [""],
            selection: null,
            undo: []
        }
        this.ref = React.createRef(null)
    }
    
    handleCompositionEnd(event) {
        const blockElements = [...event.target.childNodes]

        const focus = getBlockAllInfo(window.getSelection().focusNode);
        
        let undo = [...this.state.undo];
        undo.push({blocks: [...this.state.blocks], focus: this.state.focus})

        this.setState({
            blocks: blockElements.map(e=>e.textContent),
            focus: {index: focus.idx, offset: focus.offset},
            anchor: null,
            undo
        })
    }

    handlePasteDrop(event) {
        event.preventDefault();
        const {blocks} = this.state;
        const focus = getBlockAllInfo(event.target);

        let state = {};

        state.undo = [...this.state.undo];
        state.undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

        let data;
        if (event.nativeEvent instanceof ClipboardEvent) {
            data = event.clipboardData.getData("Text").split(/\r?\n/);
        }
        else if (event.nativeEvent instanceof DragEvent) {
            data = event.dataTransfer.getData("Text").split(/\r?\n/);
        }

        data[0] = focus.element.textContent + data[0];

        state.blocks = arraySplice(blocks, focus.idx, 1, ...data);
        
        state.focus = {index: data.length-focus.idx-1, offset: data[data.length-1].length};
        state.anchor = null;

        return this.setState(state);
    }

    handleClick(event) {
        // IMPORTANT
        // event.target is not same as window.getSelection().focusNode
        // To be conventional, use focusNode instead
        const {focusNode, focusOffset} = window.getSelection();
        if (event.target.nodeType === 1 || event.target.tagName === "INPUT") {
            return
        }
        if (window.getSelection().type === "Range") return;
        
        // trigger when plain text is empty and user keep click the block element
        // focusNode will be div.editor rather than block element 
        if (focusNode.nodeType === 1) {
            if (focusNode.classList.contains("editor") || focusNode.parentElement.classList.contains("editor")) return
        }

        const {blockElement, index} = getFocusBlockIdx(document.querySelector(".editor"), focusNode)

        this.setState({
            focus: {
                index: index,
                offset: calParentOffset(blockElement, focusNode, focusOffset)
            },
            anchor: null
        })
    }


    handleKeyDown(event) {
        const {blocks} = this.state;
        
        const {type, focusNode, anchorNode, anchorOffset} = window.getSelection();

        if (focusNode.nodeType === 1 && focusNode.classList.contains("editor")) return;

        const focus = getBlockAllInfo(focusNode);
        const anchor = getBlockAllInfo(anchorNode, anchorOffset);

        if (event.key.length === 1 && !event.ctrlKey) {
            event.preventDefault();
            
            let undo = [...this.state.undo];
            undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

            const [earlier, later] = compareBaseExtendPos(focus, anchor)
            
            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + event.key + blocks[later.idx].slice(later.offset)

            this.setState({
                blocks: arraySplice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt),
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
                    anchor: {index: blocks.length-1, offset: blocks[blocks.length-1].length}
                });
            }
            return;
        }
        case "z": {
            if (event.ctrlKey) {
                event.preventDefault();
                this.setState({
                    ...this.state.undo[this.state.undo.length-1],
                    undo: arraySplice(this.state.undo, this.state.undo.length-1, 1)
                })
            }
            return;
        }
        case "ArrowLeft": {
            event.preventDefault();
            
            let state = {};
            state.anchor = event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null; 
            
            if (type === "Range" && !event.shiftKey) {
                const [earlier,] = compareBaseExtendPos(focus, anchor)
                
                state.focus = {index: earlier.idx, offset: earlier.offset};
                return this.setState(state);
            }
            
            if (focus.offset === 0) {
                if (focus.idx === 0) return;
                
                state.focus = {index: focus.idx-1, offset: focus.prev.len};
                return this.setState(state);
            }

            state.focus = {index: focus.idx, offset: focus.offset-1};

            return this.setState(state);
        }
        case "ArrowRight": {
            event.preventDefault();
            
            let state = {};
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
            
            let state = {};
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
           
            let state = {};
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
                blocks: arraySplice(blocks, earlier.idx, later.idx-earlier.idx+1, ...replaceElt),
                focus: {index: earlier.idx+1, offset: 0},
                anchor: null,
                undo: undo
            });

            return;
        }
        case "Backspace": {
            event.preventDefault();

            let state = {anchor: null, undo: [...this.state.undo]};
            state.undo.push({blocks: [...this.state.blocks], focus: this.state.focus});

            if (type === "Caret") {
                if (focusNode.nodeType === 1 && focus.offset === 0) {
                    if (focus.idx === 0) return;
                    
                    const replaceElt = blocks[focus.idx-1]+blocks[focus.idx];
                    state.blocks = arraySplice(blocks, focus.idx-1, 2, replaceElt);

                    state.focus = {index: focus.idx-1, offset: focus.prev.len};
                    return this.setState(state);
                }
                
                const replaceElt = strSplice(blocks[focus.idx], focus.offset-1, 1);
                state.blocks = arraySplice(blocks, focus.idx, 1, replaceElt);

                state.focus = {index: focus.idx, offset: focus.offset-1}; 
                return this.setState(state);
            } 

            const [earlier, later] = compareBaseExtendPos(focus, anchor)

            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + blocks[later.idx].slice(later.offset)
            state.blocks = arraySplice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt);

            state.focus = {index: earlier.idx, offset: earlier.offset};
            return this.setState(state);
        }
        case "Delete": {
            let state = {anchor: null, undo: [...this.state.undo]};

            if (type === "Caret") {
                if (focus.offset === focus.len && blocks[focus.idx+1]) {
                    state.blocks = arraySplice(blocks, focus.idx, 2, blocks[focus.idx]+blocks[focus.idx+1]);
                    
                    state.focus = {index: focus.idx, offset: focus.offset};
                    return this.setState(state);
                }

                state.blocks = arraySplice(blocks, focus.idx, 1, strSplice(blocks[focus.idx], focus.offset, 1));
                
                state.focus = {index: focus.idx, offset: focus.offset};
                return this.setState(state);
            }

            const [earlier, later] = compareBaseExtendPos(focus, anchor)

            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + blocks[later.idx].slice(later.offset)
            state.blocks = arraySplice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt);
            
            state.focus = {index: earlier.idx, offset: earlier.offset}
            return this.setState(state);
        }
        }
    }

    handleSelect(event) {
        console.log(event)

        if (event.nativeEvent instanceof MouseEvent) {

            const {focusNode, anchorNode, anchorOffset} = window.getSelection();
            
            if (focusNode.nodeType === 1 && focusNode.classList.contains("editor")) return;

            const focus = getBlockAllInfo(focusNode);
            const anchor = getBlockAllInfo(anchorNode, anchorOffset);

            this.setState({
                focus: {index: focus.idx, offset: focus.offset},
                anchor: {index: anchor.idx, offset: anchor.offset}
            })
        }
    }
    componentDidUpdate() {
        let {focus, anchor} = this.state
        if (!focus) focus = {index: 0, offset: 0};

        const blockElts = this.ref.current.childNodes
        const focusSel = offsetFromParent(blockElts[focus.index], focus.offset);

        const detectActSiblings = (sel) => {
            if (sel.node.nodeType === 1) {
                return [sel.node.firstChild]
            }
            else if (sel.node.nodeType === 3) {
                const styleParent = getTopStyleElt(sel.node);
                const innerOffset = calParentOffset(styleParent, sel.node, sel.offset);
                
                if (innerOffset === styleParent.textContent.length && styleParent.nextSibling) {
                    return [styleParent, styleParent.nextSibling]
                }
                return [styleParent]
            }

            return [];
        }

        let active = [];
        if (anchor) {
            const anchorSel = offsetFromParent(blockElts[anchor.index], anchor.offset);
            createRange(focusSel, anchorSel);
            active.push(...detectActSiblings(anchorSel));
        }
        else {
            createRange(focusSel)
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
            <StrictMode>
            <nav>WYSIWYG Markdown Editor</nav>
    
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
                {parser(this.state.blocks.join("\r\n"))}
            </div>
            </StrictMode>
        )
    }
}

const app = ReactDOM.createRoot(document.querySelector("#app"));
app.render(<Suture />);