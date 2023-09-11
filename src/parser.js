import React from "react";
import {Image} from "./Components/Markdown/Style"
import {BlockQuota, CheckBox, Heading, Hr, Paragraph} from "./Components/Markdown/Block";

/**
 * Markdown syntax To HTML Tag
 * @param {string} plainText 
 * @returns {Array}
*/
export function parser(plainText) {
    return blockHTML(plainText);
}

function blockHTML(plainText) {
    const regex = /(?<hr>(?<=^|\n)---(?=\r?\n|$))|(?<check>(?<=^|\n) - \[(?:x| )\] .*(?=\r?\n|$))|(?<head>(?<=^|\n)#{1,6} .*(?=\r?\n|$))|(?<quota>(?<=^|\n)> .*(?=\r?\n|$))|(?<p>(?<=^|\n).+(?=\r?\n|$))|(?<br>(?<=^|\n)\r?\n|(?<=\n)|^$)/gi;

    return [...plainText.matchAll(regex)].map((match, index) => {
        const Type = Object.keys(match.groups).filter(a => match.groups[a] !== undefined)[0];
        const rawText = match.groups[Type];

        switch (Type) {
        case "p": {
            return (
                <Paragraph
                    key={index}
                    innerText={inlineHTML(rawText)}
                />
            )
        }
        case "check": {
            const matched = rawText.match(/ - \[(x| )\] (.*)/i);

            return (
                <CheckBox
                    key={index}
                    checked={matched[1]}
                    innerText={inlineHTML(matched[2])}
                />
            );
        }
        case "hr": {
            return <Hr key={index} innerText={rawText} />;
        }
        case "quota": {
            return (
                <BlockQuota
                    key={index}
                    innerText={inlineHTML(rawText.slice(2))}    
                />
            )
        }
        case "head": {
            const matched = rawText.match(/(#{1,6} )(.*)/);
            return (
                <Heading
                    Tag={`h${matched[1].length-1}`}
                    prefix={matched[1]}
                    innerText={inlineHTML(matched[2])}
                />
            )
        }
        case "br": {
            return <p key={index}><br /></p>
        }
        }
    })
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

    const regex = /(?<img>!\[.*?\]\(.+?\))|(?<link>\[.*?\]\(.+?\))|(?<b>\*{2}.+?\*{2})|(?<u>__.+?__)|(?<mark>==.+?==)|(?<del>~~.+?~~)|(?<em>\*.+?\*)|(?<code>`.+?`)|(?<text>(?:[^*_!\[`~=#]|(?<!^)#|#(?!#{0,5} .+$)|`(?!.+`)|\*(?!\*.+?\*{2}|.+?\*)|_(?!_.+?__)|~(?!~.+?~~)|=(?!=.+?==)|!(?!\[.*\]\(.+\))|\[(?!.*\]\(.+\)))+)/g;

    return [...plainText.matchAll(regex)].map((match, index)=>{
        const Style = Object.keys(match.groups).filter(a => match.groups[a] !== undefined)[0];
        const rawText = match.groups[Style];

        switch (Style) {
        case "text": {
            return (
                <span className="style" key={index}>
                    {match.groups[Style]}
                </span>
            )
        }
        case "img": {
            const matched = rawText.match(/!\[(.*)\]\((.+)\)/)
            
            return (
                <Image
                    raw={matched[0]}
                    alt={matched[1]}
                    src={matched[2]}
                />
            )
        }
        case "link": {
            const matched = match.groups[Style].match(/(\[)(.*)(\]\((.+)\))/)
            return (
                <a key={index} href={matched[4]}>
                    <span>{matched[1]}</span>
                    <span>{matched[2]}</span>
                    <span>{matched[3]}</span>
                </a>
            )
        }
        default: {
            const [, prefix, innerText, postfix] = match.groups[Style].match(new RegExp("("+delimiter[Style].source+")" + "(.+)(" + delimiter[Style].source+")"))
            
            return (
                <Style key={index} className="style">
                    <span>{prefix}</span>
                    {
                        Style === "code"
                            ? innerText
                            : inlineHTML(innerText)
                    }
                    <span>{postfix}</span>
                </Style>
            )
        }
        }
    }
    );
}
