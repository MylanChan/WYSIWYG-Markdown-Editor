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

function createRange(node, offset, type="caret") {
    const selection = window.getSelection();
    const range = document.createRange();
    
    if (type === "caret") {
        // avoid offset exceed the maximum offset of block
        if (offset > node.textContent.length) {
            range.setStart(node, node.textContent.length);
        } else {
            range.setStart(node, offset);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        return;
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

    if (parentElement.nodeType === 3) {
        return {node: parentElement, offset: offset}
    }

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
    setOffset({focusBlock: index, offset: newOffset})
    setPlainText([...parser(plainText)]);

}

function handleClick(setOffset) {
    // IMPORTANT
    // event.target is not same as window.getSelection().focusNode
    // To be conventional, use focusNode instead
    const {focusNode, focusOffset} = window.getSelection();

    if (focusNode.tagName === "P") return;

    const onTopStyle = getTopStyleElt(window.getSelection().focusNode);

    setOffset({
        focusBlock: getFocusBlockIdx(document.querySelector(".editor"), onTopStyle.parentElement).index,
        offset: calParentOffset(onTopStyle.parentElement, focusNode, focusOffset)
    })
}

function handleKeyDown(event, setOffset, setPlainText) {
    const {focusNode, focusOffset} = window.getSelection();
    const {blockElement, index} = getFocusBlockIdx(event.target, focusNode)
    
    switch (event.key) {
        case "ArrowLeft": {
            event.preventDefault();

            const blockOffset = calParentOffset(blockElement, focusNode, focusOffset)-1;
            
            if (blockOffset >= 0) {
                setOffset({focusBlock: index, offset: blockOffset});
            }
            else if (index !== 0) {
                setOffset({focusBlock: index-1,offset: event.target.childNodes[index-1].textContent.length});
            }

            return;
        }
        case "ArrowRight": {
            event.preventDefault();
            
            const blockOffset = calParentOffset(blockElement, focusNode, focusOffset)+1;
            
            if (blockOffset <= blockElement.textContent.length) {
                setOffset({focusBlock: index, offset: blockOffset});
            }
            else if (index !== event.target.childNodes.length - 1) {
                setOffset({focusBlock: index+1,offset: 0});
            }

            return;
        }

        case "ArrowUp": {
            if (index === 0) return;

            event.preventDefault();

            setOffset(pre => { return {
                focusBlock: index-1,
                offset: Math.max(pre.offset, calParentOffset(blockElement, focusNode, focusOffset))
            } })

            return;
        }
        case "ArrowDown": {
            if (index === event.target.childNodes.length - 1) return;

            event.preventDefault();

            setOffset(pre => { return {
                focusBlock: index+1,
                offset: Math.max(pre.offset, calParentOffset(blockElement, focusNode, focusOffset))
            } })

            return;
        }
        case "Enter": {
            event.preventDefault();

            const {blockElement, index} = getFocusBlockIdx(event.target, window.getSelection().focusNode)
            
            const blockOffset = calParentOffset(blockElement, window.getSelection().focusNode, window.getSelection().focusOffset)

            let plainText = []
            let idx = 0
            for (let child of [...event.target.childNodes]) {
                if (idx === index) {
                    plainText.push(child.textContent.slice(0, blockOffset));
                    plainText.push(child.textContent.slice(blockOffset));
                } else {
                    plainText.push(child.textContent)
                }
                idx++
            }
            setPlainText([...parser(plainText.join("\r\n"))])

            setOffset({focusBlock: index+1, offset: 0})
            return;
        }
        case "Backspace": {
            const blockOffset = calParentOffset(blockElement, focusNode, focusOffset);
            if (focusNode.nodeType === 1 && blockOffset === 0) {
                event.preventDefault();
                if (index === 0) return;

                let plainText = []
                let idx = 0
                for (let child of [...event.target.childNodes]) {
                    if (idx === index-1) {
                        setOffset({focusBlock: idx, offset: child.textContent.length})

                        plainText.push(child.textContent + child.nextElementSibling.textContent);
                    }
                    // no action if idx === index, since it was merged into previous block
                    else if (idx !== index) {
                        plainText.push(child.textContent)
                    }

                    idx++
                }

                setPlainText([...parser(plainText.join("\r\n"))])
    
                return;

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
        
        createRange(focus.node, focus.offset)

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