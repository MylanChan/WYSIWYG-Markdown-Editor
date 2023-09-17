/**
 * Integrate commonly used functions to simplify procedure for Editor.
 */
export class Editor {
    static Block = class {
        static info(node: Node, offset: number=window.getSelection().focusOffset) {
            if (!node) return null;
    
            let editor = Editor.Element.closest(node, ".editor");
    
            const {index, element} = Editor.Element.getTopNodeFromParent(editor, node);
    
            return {
                parent: {element: editor, nChild: editor.childNodes.length},
                element: element,
                idx: index,
                offset: Editor.Caret.offsetAtParentTextContent(element, node, offset),
                len: element.textContent.length,
                prev: ()=>Editor.Block.info(element.previousSibling, null),
                next: ()=>Editor.Block.info(element.nextSibling, null)
            }
        
        }
    }

    static Element = class {
        static farthest(child: Node, selectors: String): Node|null {
            if (!child) return null;
            child = child.nodeType === 1 ? child : child.parentElement;
    
            const closestElt = (child as HTMLElement).closest(selectors as keyof HTMLElementTagNameMap);
    
            if (closestElt && child !== closestElt) {
                return Editor.Element.farthest(closestElt, selectors);
            }
    
            return child;
        }

        static closest(child: Node, selectors: String): Node|null {
            if (!child) return null;
    
            if (child.nodeType === 1) {
                return (child as HTMLElement).closest(selectors as keyof HTMLElementTagNameMap);
            }
            return child.parentElement.closest(selectors as keyof HTMLElementTagNameMap);
        }

        static getTopNodeFromParent(parentNode: Node, childNode: Node): {index: number, element: Node}|null {
            if (!parentNode.contains(childNode)) return null;
    
            for (let [index, child] of parentNode.childNodes.entries()) {
                if (child.contains(childNode)) return {index, element: child};
            }
        }
    }

    static Caret = class {
        static offsetAtParentTextContent(parentNode: Node, childNode: Node, childOffset: number=0): number {
            if (parentNode === childNode) return childOffset;
    
            if (!parentNode.contains(childNode)) return null;
            
            let offset = childOffset;
            for (let element of [...parentNode.childNodes]) {
                if (element.contains(childNode)) {
                    return offset + Editor.Caret.offsetAtParentTextContent(element, childNode);
                }
    
                offset += element.textContent.length;
            }
        }

        /**
         * parentOffset is not the offset from window.getSelection() \
         * It is required to pre-calculate offset at the parent textContent
         */
        static nodeAtParentTextOffset(parentNode: Node, parentOffset: number): {node: Node, offset: number} {   
            if (!parentNode) return;
            if (parentNode.nodeType === 1 && parentOffset === 0) return {node: parentNode, offset: 0};
        
            if (parentOffset > parentNode.textContent.length) {
                return Editor.Caret.nodeAtParentTextOffset(parentNode, parentNode.textContent.length);
            }
            
            let offset = parentOffset;
            for (let child of [...parentNode.childNodes]) {
                if (offset <= child.textContent.length) {
                    return Editor.Caret.nodeAtParentTextOffset(child, offset);
                }
                offset -= child.textContent.length;
            }

            return {node: parentNode, offset: parentOffset};
        }
        
        static isOnNodeSide(node: Node, offset: number): {left: Boolean, right: Boolean}|null {
            if (!node) return null;
    
            let side = {left: false, right: false};
            if (offset === 0) side.left = true;
    
            if (offset === node.textContent.length) side.right = true;
    
            return side;
        }

        static createRange(focus: {node: Node, offset: number}, anchor?: {node: Node, offset: number}): void {
            const selection = window.getSelection();
            if (anchor) {
                selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset)
            } else {
                selection.setPosition(focus.node, focus.offset)
            }
        }
    }

    static Object = class {
        /**
         * Same as Array.splice, but returns the new array instead of the deleted elements.
         */
        static splice(data: String|any[], start: number, deleteCount: number, ...replaceElt: any[]): String|any[] {
            if (typeof data === "string") {
                let charList = data.split("");
    
                charList.splice(start, deleteCount, ...replaceElt);
                return charList.join("") as any;
            }
            
            if (data instanceof Array) {
                data.splice(start, deleteCount, ...replaceElt);
                return data;
            }
        }
    }
}