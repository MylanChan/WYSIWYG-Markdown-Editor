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

    handleClick(event) {
        // IMPORTANT
        // event.target is not same as window.getSelection().focusNode
        // To be conventional, use focusNode instead
        const {focusNode, focusOffset} = window.getSelection();
        if (event.target.nodeType === 1 && event.target.tagName === "INPUT") {
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

            this.setState({
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
            
            if (type === "Range" && !event.shiftKey) {
                const [earlier,] = compareBaseExtendPos(focus, anchor)

                this.setState({
                    focus: {index: earlier.idx, offset: earlier.offset},
                })
            }
            else if (focus.offset === 0) {
                if (focus.idx === 0) return;
                this.setState({
                    focus: {index: focus.idx-1, offset: focus.prev.len},
                })   
            }
            else {
                this.setState({
                    focus: {index: focus.idx, offset: focus.offset-1},
                })
            }
    
            return;
        }
        case "ArrowRight": {
            event.preventDefault();

            if (type === "Range" && !event.shiftKey) {
                const [, later] = compareBaseExtendPos(focus, anchor)

                this.setState({
                    focus: {index: later.idx, offset: later.offset},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
                })
            } else if (focus.offset === focus.len) {
                if (focus.idx === this.ref.current.childNodes.length-1) return
                this.setState({
                    focus: {index: focus.idx+1, offset: 0},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
                })
            } else {
                this.setState({
                    focus: {index: focus.idx, offset: focus.offset+1},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
                })
            }
    
            return;
        }
        case "ArrowUp": {
            event.preventDefault();
            if (focus.idx === 0) {
                this.setState({
                    focus: {index: focus.idx, offset: 0},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null,
                })
            } else {
                this.setState(pre => ({
                    focus: {index: focus.idx-1, offset: Math.max(pre.focus.offset, focus.offset)},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null,
                }))
            } 
    
            return;
        }
        case "ArrowDown": {
            event.preventDefault();
            if (focus.idx === event.target.childNodes.length - 1) {
                this.setState({
                    focus: {index: focus.idx, offset: focus.len},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null,
                })
            } else {
                this.setState(pre => ({
                    focus: {index: focus.idx+1, offset: Math.max(pre.focus.offset, focus.offset)},
                    anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null,
                }))
            }
            return;
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
        case "Backspace": case "Delete": {
            event.preventDefault();
            let undo = [...this.state.undo];
            undo.push({
                blocks: [...this.state.blocks],
                focus: this.state.focus,
            })

            this.setState({undo: undo, anchor: null})
            if (type === "Caret") {
                if (event.key === "Backspace") {
                    if (focusNode.nodeType === 1 && focus.offset === 0) {
                        if (focus.idx === 0) return;
                        
                        this.setState({
                            blocks: arraySplice(blocks, focus.idx-1, 2, blocks[focus.idx-1]+blocks[focus.idx]),
                            focus: {index: focus.idx-1, offset: focus.prev.len},
                        })
                    } else {
                        this.setState({
                            blocks: arraySplice(blocks, focus.idx, 1, strSplice(blocks[focus.idx], focus.offset-1, 1)),
                            focus: {index: focus.idx, offset: focus.offset-1},
                        })
                    }
                } else {
                    if (focus.offset === focus.len && blocks[focus.idx+1]) {
                        this.setState({
                            blocks: arraySplice(blocks, focus.idx, 2, blocks[focus.idx]+blocks[focus.idx+1]),
                            focus: {index: focus.idx, offset: focus.offset},
                        })
                    } else {
                        this.setState({
                            blocks: arraySplice(blocks, focus.idx, 1, strSplice(blocks[focus.idx], focus.offset, 1)),
                            focus: {index: focus.idx, offset: focus.offset},
                        })
                    }
                }
                return;
            } 
            const [earlier, later] = compareBaseExtendPos(focus, anchor)

            const replaceElt = blocks[earlier.idx].slice(0, earlier.offset) + blocks[later.idx].slice(later.offset)

            this.setState({
                blocks: arraySplice(blocks, earlier.idx, later.idx-earlier.idx+1, replaceElt),
                focus: {index: earlier.idx, offset: earlier.offset},
            })

            return;
        }
        }
    }

    handleSelect(event) {
        if (event.nativeEvent instanceof MouseEvent) {
            const {focusNode, anchorNode, anchorOffset} = window.getSelection();
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
                onClick={this.handleClick.bind(this)}
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