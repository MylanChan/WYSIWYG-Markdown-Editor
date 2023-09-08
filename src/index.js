import React, { StrictMode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { parser } from "./parser";

function getTopStyleElt(child) {
    if (!child?.parentElement?.tagName) return undefined

    if (child.parentElement.tagName === "P") {
        return child
    } else {
        return getTopStyleElt(child.parentElement)
    }
}


function getBlockAllInfo(node, offset=window.getSelection().focusOffset) {
    const {blockElement, index} = getFocusBlockIdx(document.querySelector(".editor"), node);
    return {
        parent: () => {
            return {
                children: this.element.parentElement.childNodes,
                nChild: this.element.parentElement.childNodes.length
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
 * 
 * @param {Node} focusNode 
 * @param {number} focusOffset 
 * @param {Node} anchorNode 
 * @param {number} anchorOffset 
 * @param {"Caret"|"Range"} type 
 * @returns 
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

/**
 * 
 * @param {Node} parentElement 
 * @param {number} offset 
 * @returns {{node: Node, offset: number}} 
 */
function offsetFromParent(parentElement, offset) {
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
    let index = 0
    for (let blockElement of [...parentElement.childNodes]) {
        if (blockElement.contains(child)) {
            return {blockElement, index}
        }
        index += 1
    }

}

function handleInput(event, setOffset, setPlainText) {
    if (event.nativeEvent?.isComposing) return

    const blockElements = [...event.target.childNodes]
    const {focusNode, focusOffset} = window.getSelection();

    const plainText = blockElements.map(elt => elt.textContent).join("\r\n");

    const {index} = getFocusBlockIdx(event.target, focusNode)
    const offset = calParentOffset(blockElements[index], focusNode, focusOffset)

    // calculate the offset with respected to block element
    setOffset({type: "Caret", focus: {index, offset}});
    setPlainText(plainText);

}

function handleClick(setOffset) {
    // IMPORTANT
    // event.target is not same as window.getSelection().focusNode
    // To be conventional, use focusNode instead
    const {focusNode, focusOffset} = window.getSelection();
    
    if (window.getSelection().type === "Range") return;
    
    // trigger when plain text is empty and user keep click the block element
    // focusNode will be div.editor rather than block element 
    if (focusNode.nodeType === 1) {
        if (focusNode.classList.contains("editor") || focusNode.tagName === "P") return
    }

    const {blockElement, index} = getFocusBlockIdx(document.querySelector(".editor"), focusNode)

    setOffset({
        focus: {index: index, offset: calParentOffset(blockElement, focusNode, focusOffset)}
    })
}

function handleKeyDown(event, setOffset, setPlainText) {
    const {focusNode, anchorNode, anchorOffset} = window.getSelection();
    
    const focus = getBlockAllInfo(focusNode);
    const anchor = getBlockAllInfo(anchorNode, anchorOffset);

    switch (event.key) {
    case "ArrowLeft": {
        event.preventDefault();
        if (focus.offset === 0) {
            if (focus.idx === 0) return;
            
            setOffset({
                focus: {index: focus.idx-1, offset: focus.prev.len},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            });

        } else if (window.getSelection().type === "Range" && !event.shiftKey) {
            // code 
        } else {
            setOffset({
                focus: {index: focus.idx, offset: focus.offset-1},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
        }

        return;
    }
    case "ArrowRight": {
        event.preventDefault();
        
        if (window.getSelection().type === "Range" && !event.shiftKey) {
            // code
        } else if (focus.offset === focus.len) {
            if (focus.idx === focus.parent().nChild-1) return

            setOffset({
                focus: {index: focus.idx+1, offset: 0},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
        } else {
            setOffset({
                focus: {index: focus.idx, offset: focus.offset+1},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
        }

        return;
    }

    case "ArrowUp": {
        event.preventDefault();
        if (focus.idx === 0) {
            setOffset({
                focus: {index: focus.idx, offset: 0},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
        } else {
            setOffset(pre => ({
                focus: {index: focus.idx-1, offset: Math.max(pre.focus.offset, focus.offset)},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            }))    
        }

        return;
    }
    case "ArrowDown": {
        event.preventDefault();
        if (focus.idx === event.target.childNodes.length - 1) {
            setOffset({
                focus: {index: focus.idx, offset: focus.len},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            })
        } else {
            setOffset(pre => ({
                focus: {index: focus.idx+1, offset: Math.max(pre.focus.offset, focus.offset)},
                anchor: event.shiftKey ? {index: anchor.idx, offset: anchor.offset} : null
            }))                
        }
        return;
    }
    case "Enter": {
        event.preventDefault();
        if (window.getSelection().type === "Caret" || anchor.idx === focus.idx) {
            let plainText = []
            for (let [idx, child] of event.target.childNodes.entries()) {
                if (idx === focus.idx) {
                    plainText.push(child.textContent.slice(0, focus.offset));
                    plainText.push(child.textContent.slice(focus.offset));
                } else {
                    plainText.push(child.textContent)
                }
            }
            setPlainText(plainText.join("\r\n"))

            setOffset({focus:{index: focus.idx+1, offset: 0}})
            return;
        } else if (window.getSelection().type === "Range") {
            let plainText = [];
            const earlierBlock = focus.idx < anchor.idx ? focus : anchor;
            const laterBlock = focus.idx < anchor.idx ? anchor : focus;
                
            for (let [idx, child] of event.target.childNodes.entries()) {
                if (idx === earlierBlock.idx) {
                    plainText.push(child.textContent.slice(0, earlierBlock.offset));

                } else if (idx === laterBlock.idx) {
                    plainText.push(child.textContent.slice(laterBlock.offset));

                } else if (idx < earlierBlock.idx || idx > laterBlock.idx) {
                    plainText.push(child.textContent);
                }
            }

            setOffset({focus: {index: earlierBlock.idx+1, offset: 0}});
        
            setPlainText(plainText.join("\r\n"));
            return;
        }
    }
    case "Backspace": case "Delete": {
        if (window.getSelection().type === "Caret") {
            if (event.key === "Backspace") {
                if (focusNode.nodeType === 1 && focus.offset === 0) {
                    event.preventDefault();
                    if (focus.idx === 0) return;
    
                    let plainText = [];
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === focus.idx) {
                            plainText[idx-1] += child.textContent.slice(focus.offset)        
                        } else { 
                            plainText.push(child.textContent)
                        }
                    }
                    setPlainText(plainText.join("\r\n"))
                    setOffset({
                        focus: {index: focus.idx-1, offset: focus.prev.len}
                    });
                } else {
                    setTimeout(()=>{

                    }, 0)
                }
            } else {
                if (focus.offset === focus.len) {
                    event.preventDefault();
                    let plainText = [];
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === focus.idx+1) {
                            plainText[plainText.length-1] += child.textContent;
                        } else {
                            plainText.push(child.textContent);
                        }
                    }
    
                    setOffset({focus: {index: focus.idx, offset: focus.offset}})
                    setPlainText(plainText.join("\r\n"))
                }
            }

        } else if (window.getSelection().type === "Range" && focus.idx !== anchor.idx) {
            event.preventDefault();
            const earlierBlock = focus.idx < anchor.idx ? focus : anchor;
            const laterBlock = focus.idx < anchor.idx ? anchor : focus;
                
            let plainText = [];
            for (let [idx, child] of event.target.childNodes.entries()) {
                if (idx === earlierBlock.idx) {
                    plainText.push(child.textContent.slice(0, earlierBlock.offset));
                    
                } else if (idx === laterBlock.idx) {
                    plainText[plainText.length-1] += child.textContent.slice(laterBlock.offset)
                
                } else if (laterBlock.idx < idx || idx < earlierBlock.idx) {
                    plainText.push(child.textContent)
                }
            }
            setPlainText(plainText.join("\r\n"));
            setOffset({
                focus: {index: earlierBlock.idx, offset: earlierBlock.offset}
            });
            
        }
        return;
    }
    }
}

function Suture(props) {
    const [plainText, setPlainText] = useState("");

    const [selection, setOffset] = useState(null);
    const ref = useRef();

    useEffect(()=>{
        if (!selection) return;
        const focusBlock = ref.current.childNodes[selection.focus.index];
        const focus = offsetFromParent(focusBlock, selection.focus.offset);
        
        if (!selection.anchor) {
            createRange(focus)
    
        } else {
            const anchorBlock = ref.current.childNodes[selection.anchor.index];
            const anchor = offsetFromParent(anchorBlock, selection.anchor.offset);
            createRange(focus, anchor)
        }
        
        // remove old active element
        for (let element of document.querySelectorAll(".act")) {
            element.classList.remove("act")
        }

        // find out and add new active element
        for (let innerElt of [...focusBlock.childNodes]) {
            if (innerElt.contains(focus.node) || innerElt === focus.node) {
                if (innerElt.nodeType === 1) innerElt.classList.add("act")
                break;
            }
        }

        // handle which element should be a plain text
        if (focus.node) {
            // most cases, e.g. input character / left-right caret movement
            if (focus.node.nodeType === 3) {
                const styleParent = getTopStyleElt(focus.node);
                const {textContent, nextSibling} = styleParent;

                if (calParentOffset(styleParent, focus.node, focus.offset) === textContent.length) {
                    if (nextSibling && nextSibling.nodeType === 1) {
                        nextSibling.classList.add("act");
                    }
                }
            }
            // Handle caret and offset when Input Enter
            else if (focus.node.nodeType === 1 && focus.node.firstChild.nodeType === 1) {
                focus.node.firstChild.classList.add("act")
            }
        }
    }, [selection])

    return (
        <StrictMode>
        <nav>Suture Editor</nav>

        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning

            className="editor"

            onKeyDown={e => {handleKeyDown(e, setOffset, setPlainText)}}
            onInput={e => {handleInput(e, setOffset, setPlainText)}}
            onCompositionEnd={e => {handleInput(e ,setOffset, setPlainText)}}
            onClick={()=>{handleClick(setOffset)}}
        >
            {parser(plainText)}
        </div>
        </StrictMode>
    )
}


const app = ReactDOM.createRoot(document.querySelector("#app"));
app.render(<Suture />);