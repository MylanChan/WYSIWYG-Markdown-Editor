import React, { StrictMode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { parser } from "./parser";

function getTopStyleElt(child) {
    if (!child?.parentElement?.tagName) return undefined

    if (child.parentElement.parentElement.classList.contains("editor")) {
        return child
    } else {
        return getTopStyleElt(child.parentElement)
    }
}

function splitTwo(text, offset, preMove=0, laterMove=0) {
    return [text.slice(0, offset+preMove), text.slice(offset+laterMove)]
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
    for (let [index, blockElement] of parentElement.childNodes.entries()) {
        if (blockElement.contains(child)) {
            return {blockElement, index}
        }
    }
}

function handleCompositionEnd(event, setOffset, setPlainText) {
    event.preventDefault();
    const blockElements = [...event.target.childNodes]
    const {focusNode} = window.getSelection();

    const focus = getBlockAllInfo(focusNode);
    
    setOffset({focus: {index: focus.idx, offset: focus.offset}});

    setPlainText(blockElements.map(e=>e.textContent))
}

function handleClick(event, setOffset) {
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

    setOffset({
        focus: {index: index, offset: calParentOffset(blockElement, focusNode, focusOffset)}
    })
}

function handleKeyDown(event, setOffset, setPlainText) {
    const {focusNode, anchorNode, anchorOffset} = window.getSelection();
    
    const focus = getBlockAllInfo(focusNode);
    const anchor = getBlockAllInfo(anchorNode, anchorOffset);

    if (event.key.length === 1 && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        if (window.getSelection().type === "Caret") {
            setOffset({focus: {index: focus.idx, offset: focus.offset+1}})
        
            setPlainText(pre => {
                const replaceText = strSplice(pre[focus.idx], focus.offset, 0, event.key)
                return arraySplice(pre, focus.idx, 1, replaceText)
            })
        } else {
            const earlierBlock = focus.idx < anchor.idx ? focus : anchor;
            const laterBlock = focus.idx < anchor.idx ? anchor : focus;
                
            setPlainText(pre => {
                return arraySplice(pre, earlierBlock.idx, laterBlock.idx-earlierBlock.idx+1,
                    pre[earlierBlock.idx].slice(0, earlierBlock.offset) + event.key + pre[laterBlock.idx].slice(laterBlock.offset)
                )
            });
            setOffset({
                focus: {index: earlierBlock.idx, offset: earlierBlock.offset+1}
            });
        }
        return;
    }

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
            setPlainText(pre => {
                return arraySplice(pre, focus.idx, 1, ...splitTwo(pre[focus.idx], focus.offset))
            })

            setOffset({focus:{index: focus.idx+1, offset: 0}})
            return;
        } else if (window.getSelection().type === "Range") {
            const earlierBlock = focus.idx < anchor.idx ? focus : anchor;
            const laterBlock = focus.idx < anchor.idx ? anchor : focus;
                
            setOffset({focus: {index: earlierBlock.idx+1, offset: 0}});
            
            setPlainText(pre => {
                return arraySplice(pre, earlierBlock.idx, laterBlock.idx-earlierBlock.idx+1,
                    pre[earlierBlock.idx].slice(0, earlierBlock.offset), pre[laterBlock.idx].slice(laterBlock.offset)
                )
            });

            return;
        }
    }
    case "Backspace": case "Delete": {
        if (window.getSelection().type === "Caret") {
            if (event.key === "Backspace") {
                if (focusNode.nodeType === 1 && focus.offset === 0) {
                    event.preventDefault();
                    if (focus.idx === 0) return;
    
                    setPlainText(array => {
                        return arraySplice(array, focus.idx-1, 2, pre[focus.idx-1] + pre[focus.idx])
                    })

                    setOffset({
                        focus: {index: focus.idx-1, offset: focus.prev.len}
                    });
                } else {
                    event.preventDefault();
                    setPlainText(pre => {
                        pre.splice(focus.idx, 1, strSplice(pre[focus.idx], focus.offset-1, 1, ""))
                        return pre;
                    });

                    setOffset({
                        focus: {index: focus.idx, offset: focus.offset-1}
                    })
                }
            } else {
                if (focus.offset === focus.len) {
                    event.preventDefault();

                    setOffset({focus: {index: focus.idx, offset: focus.offset}})
                    setPlainText(pre => {
                        return arraySplice(pre, focus.idx, 2, pre[focus.idx]+pre[focus.idx+1])
                    })
                }
            }

        } else if (window.getSelection().type === "Range" && focus.idx !== anchor.idx) {
            event.preventDefault();
            const earlierBlock = focus.idx < anchor.idx ? focus : anchor;
            const laterBlock = focus.idx < anchor.idx ? anchor : focus;
                
            setPlainText(pre => {
                return arraySplice(pre, earlierBlock.idx, laterBlock.idx-earlierBlock.idx+1,
                    pre[earlierBlock.idx].slice(0, earlierBlock.offset) + pre[laterBlock.idx].slice(laterBlock.offset)
                )
            });
            setOffset({
                focus: {index: earlierBlock.idx, offset: earlierBlock.offset}
            });
            
        }
        return;
    }
    }
}

function Suture(props) {
    const [plainText, setPlainText] = useState([""]);

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
            onCompositionEnd={e => {handleCompositionEnd(e ,setOffset, setPlainText)}}
            onClick={(e)=>{handleClick(e, setOffset)}}
        >
            {parser(plainText.join("\r\n"))}
        </div>
        </StrictMode>
    )
}


const app = ReactDOM.createRoot(document.querySelector("#app"));
app.render(<Suture />);