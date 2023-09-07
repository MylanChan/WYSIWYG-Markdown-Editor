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

/**
 * 
 * @param {Node} focusNode 
 * @param {number} focusOffset 
 * @param {Node} anchorNode 
 * @param {number} anchorOffset 
 * @param {"Caret"|"Range"} type 
 * @returns 
 */
function createRange(focusNode, focusOffset, anchorNode=null, anchorOffset=null, type="Caret") {
    const selection = window.getSelection();
    
    // avoid offset exceed the maximum offset of block
    if (type === "Caret") {
        selection.setPosition(focusNode, focusOffset)
    } else if (type === "Range") {
        selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset)
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

function handleInput(event, setOffset, setPlainText, offset) {
    if (event.nativeEvent?.isComposing) return

    const blockElements = [...event.target.childNodes]
    const {focusNode, focusOffset} = window.getSelection();

    const plainText = blockElements.map(elt => elt.textContent).join("\r\n");

    const {index} = getFocusBlockIdx(event.target, focusNode)
    const newOffset = calParentOffset(blockElements[index], focusNode, focusOffset)

    // calculate the offset with respected to block element
    setOffset({type: "Caret", focusBlock: index, offset: newOffset})
    setPlainText([...parser(plainText)]);

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

    const onTopStyle = getTopStyleElt(window.getSelection().focusNode);

    setOffset({
        type: "Caret", 
        focusBlock: getFocusBlockIdx(document.querySelector(".editor"), onTopStyle.parentElement).index,
        offset: calParentOffset(onTopStyle.parentElement, focusNode, focusOffset)
    })
}

function handleKeyDown(event, setOffset, setPlainText) {
    const {focusNode, focusOffset, anchorNode, anchorOffset} = window.getSelection();
    
    const blockList = event.target.childNodes

    const anchor = getFocusBlockIdx(event.target, anchorNode);
    anchor.offset = calParentOffset(anchor.blockElement, anchorNode, anchorOffset);

    const focus = getFocusBlockIdx(event.target, focusNode);
    focus.offset = calParentOffset(focus.blockElement, focusNode, focusOffset);

    switch (event.key) {
        case "ArrowLeft": {
            event.preventDefault();

            if (event.shiftKey) {
                const selectionInfo = {
                    type: "Range",
                    anchorIndex: anchor.index,
                    anchorOffset: anchor.offset
                }

                if (focus.offset-1 < 0) {
                    if (focus.index === 0) return;
                    setOffset({
                        focusBlock: focus.index-1,
                        offset: event.target.childNodes[focus.index-1].textContent.length,
                        
                        ...selectionInfo
                    })
                } else {
                    setOffset({
                        focusBlock: focus.index,
                        offset: focus.offset-1,
                        ...selectionInfo
                    })
                }
            } else if (window.getSelection().type === "Range") {
                // code
            } else if (focus.offset === 0) {
                if (focus.index === 0) return;
                setOffset({
                    type: "Caret",
                    focusBlock: focus.index-1,
                    offset: blockList[focus.index-1].textContent.length
                })
            } else {
                setOffset({
                    type: "Caret",
                    focusBlock: focus.index,
                    offset: focus.offset-1
                })
            }

            return;
        }
        case "ArrowRight": {
            event.preventDefault();
            
            if (event.shiftKey) {
                const selectionInfo = {
                    type: "Range",
                    anchorIndex: anchor.index,
                    anchorOffset: anchor.offset
                }

                if (focus.offset === focus.blockElement.textContent.length) {
                    if (focus.index === event.target.childNodes.length-1) return;
                    setOffset({focusBlock: focus.index+1, offset: 0, ...selectionInfo})
                } else {
                    setOffset({focusBlock: focus.index, offset: focus.offset+1, ...selectionInfo})
                }
            } else if (window.getSelection().type === "Range") {
                // code
            } else if (focus.offset === focus.blockElement.textContent.length) {
                if (focus.index === event.target.childNodes.length-1) return

                setOffset({type: "Caret", focusBlock: focus.index+1, offset: 0})
            } else {
                setOffset({type: "Caret", focusBlock: focus.index, offset: focus.offset+1})
            }

            return;
        }

        case "ArrowUp": {
            event.preventDefault();
            if (event.shiftKey) {
                const selectionInfo = {
                    type: "Range",
                    anchorIndex: anchor.index,
                    anchorOffset: anchor.offset                    
                }

                if (focus.index === 0) {
                    setOffset({focusBlock: focus.index, offset: 0, ...selectionInfo});
                } else {
                    setOffset({focusBlock: focus.index-1, offset: focus.offset, ...selectionInfo});
                }
                return;
            }
            if (focus.index === 0) {
                setOffset({
                    type: "Caret",
                    focusBlock: focus.index,
                    offset: 0
                })
            } else {
                setOffset(pre => { return {
                    type: "Caret", 
                    focusBlock: focus.index-1,
                    offset: Math.max(pre.offset, focus.offset)
                } })    
            }

            return;
        }
        case "ArrowDown": {
            event.preventDefault();
            if (event.shiftKey) {
                const selectionInfo = {
                    type: "Range",
                    anchorIndex: anchor.index,
                    anchorOffset: anchor.offset
                }
                
                if (focus.index === event.target.childNodes.length - 1) {
                    setOffset({
                        focusBlock: focus.index,
                        offset: focus.blockElement.textContent.length,
                        ...selectionInfo
                    })
                } else {
                    setOffset({
                        focusBlock: focus.index+1,
                        offset: focus.offset,
                        ...selectionInfo
                    })
                }
            } else if (focus.index === event.target.childNodes.length - 1) {
                setOffset({
                    type: "Caret",
                    focusBlock: focus.index,
                    offset: focus.blockElement.textContent.length
                })
            } else {
                setOffset(pre => { return {
                    type: "Caret", 
                    focusBlock: focus.index+1,
                    offset: Math.max(pre.offset, focus.offset)
                } })                
            }

            return;
        }
        case "Enter": {
            event.preventDefault();
            if (window.getSelection().type === "Caret" || anchor.index === focus.index) {
                let plainText = []
                let idx = 0
                for (let child of [...event.target.childNodes]) {
                    if (idx === focus.index) {
                        plainText.push(child.textContent.slice(0, focus.offset));
                        plainText.push(child.textContent.slice(focus.offset));
                    } else {
                        plainText.push(child.textContent)
                    }
                    idx++
                }
                setPlainText([...parser(plainText.join("\r\n"))])
    
                setOffset({type: "Caret", focusBlock: focus.index+1, offset: 0})
                return;
            } else if (window.getSelection().type === "Range") {
                let plainText = [];
                let idx = 0;
                if (anchor.index > focus.index) {
                    for (let child of [...event.target.childNodes]) {
                        if (idx === focus.index) {
                            plainText.push(child.textContent.slice(0, focus.offset));
                        } else if (idx > focus.index && idx < anchor.index) {
                            
                        } else if (idx === anchor.index) {
                            plainText.push(child.textContent.slice(anchor.offset))
                        } else {
                            plainText.push(child.textContent)
                        }
                        idx++
                    }
                    setOffset({
                        type: "Caret",
                        focusBlock: focus.index+1,
                        offset: 0
                    })
                } else {
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === anchor.index) {
                            plainText.push(child.textContent.slice(0, anchor.offset));
                        }
                        else if (idx === focus.index) {
                            plainText.push(child.textContent.slice(focus.offset))
                        }
                        else if (focus.index < idx || idx < anchor.index) {
                            plainText.push(child.textContent)
                        }
                    }

                    setOffset({type: "Caret", focusBlock: anchor.index+1, offset: 0})
                }
                
                setPlainText([...parser(plainText.join("\r\n"))]);
                return;
            }
        }
        case "Backspace": {

            if (window.getSelection().type === "Range") {
                event.preventDefault();
                if (anchor.index > focus.index) {
                    let plainText = [];
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === focus.index) {
                            plainText.push(child.textContent.slice(0, focus.offset));
                            
                        } else if (idx === anchor.index) {
                            plainText[plainText.length-1] += child.textContent.slice(anchor.offset)
                        
                        } else if ( anchor.index < idx || idx < focus.index) {
                            plainText.push(child.textContent)
                        }
                    }
                    setPlainText([...parser(plainText.join("\r\n"))]);
                    setOffset({type: "Caret", focusBlock: focus.index, offset: focus.offset});

                } else if (focus.index > anchor.index) {
                    let plainText = [];
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === anchor.index) {
                            plainText.push(child.textContent.slice(0, anchor.offset));
                        } else if (idx === focus.index) {
                            plainText[plainText.length-1] += child.textContent.slice(focus.offset)
                        } else if (focus.index < idx || idx < anchor.index) {
                            plainText.push(child.textContent)
                        }
                    }

                    setPlainText([...parser(plainText.join("\r\n"))])
                    setOffset({type: "Caret", focusBlock: anchor.index, offset: anchor.offset});
                }
            } else if (window.getSelection().type === "Caret") {
                if (focusNode.nodeType === 1 && focus.offset === 0) {
                    event.preventDefault();
                    if (focus.index === 0) return;

                    let plainText = [];
                    for (let [idx, child] of event.target.childNodes.entries()) {
                        if (idx === focus.index) {
                            plainText[idx-1] += child.textContent.slice(focus.offset)        
                        } else { 
                            plainText.push(child.textContent)
                        }
                    }
                    setPlainText([...parser(plainText.join("\r\n"))])
                    setOffset({type: "Caret", focusBlock: focus.index-1, offset: event.target.childNodes[focus.index-1].textContent.length});
                }
            }
            return;
        }
    }
}

function Suture(props) {
    const [plainText, setPlainText] = useState([...parser("")]);

    const [offset, setOffset] = useState(null);
    const ref = useRef(null);

    useEffect(()=>{
        if (!offset) return;
        const focusBlock = [...ref.current.childNodes][offset.focusBlock];
        const focus = offsetFromParent(focusBlock, offset.offset);
        
        if (offset.type === "Caret") {
        
            createRange(focus.node, focus.offset)
    
        } else if (offset.type === "Range") {
            const anchorBlock = [...ref.current.childNodes][offset.anchorIndex];
            const anchor = offsetFromParent(anchorBlock, offset.anchorOffset);
            createRange(focus.node, focus.offset, anchor.node, anchor.offset, "Range")
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
                const {textContent, nextElementSibling} = styleParent;

                if (calParentOffset(styleParent, focus.node, focus.offset) === textContent.length) {
                    if (nextElementSibling) nextElementSibling.classList.add("act");
                }
            }
            // Handle caret and offset when Input Enter
            else if (focus.node.nodeType === 1) {
                focus.node.firstChild.classList.add("act")
            }
        }
    }, [offset])

    return (
        <StrictMode>
        <nav>Suture Editor</nav>

        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning

            // key={plainText}
            className="editor"

            onKeyDown={e => {handleKeyDown(e, setOffset, setPlainText)}}
            onInput={e => {handleInput(e, setOffset, setPlainText, offset)}}
            onCompositionEnd={e => {handleInput(e ,setOffset, setPlainText, offset)}}
            onClick={()=>{handleClick(setOffset)}}
        >
            {plainText}
        </div>
        </StrictMode>
    )
}


const app = ReactDOM.createRoot(document.querySelector("#app"));
app.render(<Suture />);