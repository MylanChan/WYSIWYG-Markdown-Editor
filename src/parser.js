import React, { useEffect, useRef, useState } from "react";
/**
 * Markdown syntax To HTML Tag
 * @param {string} plainText 
 * @returns {Array}
*/
export function parser(plainText) {
    return blockHTML(plainText);
}

function Paragraph(props) {
    const {innerText} = props
    
    return (
        <p key={inlineHTML(innerText)}>{inlineHTML(innerText)}</p>
    )
}

function TextGroup(props) {
    const {Tag, delimiter, innerText, onClick} = props;

    return (
        <Tag className="style">
            <span key={`${Math.random()}`}>{delimiter}</span>
            {inlineHTML(innerText)}
            <span key={`${Math.random()}`} >{delimiter}</span>
        </Tag>
    )
}

function blockHTML(plainText) {
    const regex = /(?<p>(?<=^|\n).+(?=\r?\n|$))|(?<br>(?<=^|\n)\r?\n|(?<=\n)|^$)/g;
    const matches = plainText.matchAll(regex);

    const element = [];

    let i = 0
    for (let match of [...matches]) {
        // find what group the match belonging
        let style = undefined;
        for (let group in match.groups) {
            if (match.groups[group] !== undefined) {
                style = group;
            }
        }
        if (!style) continue; // it may some error here
        
        switch (style) {
            case "p": {
                element.push(
                    <Paragraph key={i} innerText={match.groups[style]} />
                );
                i++
                continue
            }
            case "br": {
                element.push(
                    <p key={i}>
                        <span key={<br/>}>
                            <br />
                        </span>
                    </p>
                )
                i++
                continue;
            }
            case "default": {
                continue;
            }
        }
    }
    return element;
}

function inlineHTML(plainText) {
    const delimiter = {
        mark: /==/,
        del: /~~/,
        b: /\*\*/,
        em: /\*/,
        code: /`/,
        u: /__/
    }

    const regex = /(?<b>\*{2}.+?\*{2})|(?<u>__.+?__)|(?<mark>==.+?==)|(?<del>~~.+?~~)|(?<em>\*.+?\*)|(?<code>`.+?`)|(?<text>(?:[^*_`~=#]|(?<!^)#|#(?!#{0,5} .+$)|`(?!.+`)|\*(?!\*.+?\*{2}|.+?\*)|_(?!_.+?__)|~(?!~.+?~~)|=(?!=.+?==))+)/g;

    const matches = plainText.matchAll(regex);
    
    const element = [];
    
    let index = 0
    for (let match of [...matches]) {
        // find what group the match belonging
        let style = undefined;
        for (let group in match.groups) {
            if (match.groups[group] !== undefined) {
                style = group;
            }
        }
        if (!style) continue; // it may some error here
        switch (style) {
            case "text": {
                element.push(
                    <span>{match.groups[style]}</span>
                    );
                index++;
                continue;
            }
            default: {
                const [, prefix, innerText, postfix] = match.groups[style].match(new RegExp("("+delimiter[style].source+")" + "(.+)(" + delimiter[style].source+")"))
                
                element.push(
                    <TextGroup
                        key={index}
                        Tag = {style}
                        delimiter = {postfix}
                        innerText = {innerText} />
                )
                index++;
            }
        }
    }
    return element;
}
