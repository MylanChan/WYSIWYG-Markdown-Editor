import React, { useEffect, useState } from "react";

declare type inlineStyle = "b" | "em" | "del" | "mark" | "code" | "img" | "a" | "text" | "link" | "strong" | "sub" | "sup" | "i" | "small" | "big" | "var" | "cite" | "dfn" | "kbd" | "abbr" | "span";

export class MDparser {
    private blockPattern = {
        general: {
            hr: /---/,
            check: / - \[(?:x| )\] .*/,
            head: /#{1,6} .*/,
            quota: /> .*/,
            p: /.+/
        },

        alien: {
            br: /^$/
        }
    }

    private stylePattern = {
        general: {
            b: /\*\*/,
            del: /~~/,
            mark: /==/,
            em: /\*/,
            code: /`/,
            u: /__/ 
        },
        
        alien: {
            img: /!\[.*?\]\(.+?\)/,
            link: /\[.*?\]\(.+?\)/,
            text: /(?:[^*_!\[`~=]|`(?!.+`)|\*(?!\*.+?\*{2}|.+?\*)|_(?!_.+?__)|~(?!~.+?~~)|=(?!=.+?==)|!(?!\[.*\]\(.+\))|\[(?!.*\]\(.+\)))+/
        }
    }

    private constructRegex(type: "block"|"style") {
        if (type === "block") {
            let pattern = [];
            for (let type in this.blockPattern.general) {
                pattern.push(`(?<${type}>^${this.blockPattern.general[type].source}$)`)
            }
    
            for (let type in this.blockPattern.alien) {
                pattern.push(`(?<${type}>${this.blockPattern.alien[type].source})`)
            }

            return new RegExp(pattern.join("|"), "gmi");
        }
        else if (type === "style") {
            let pattern = [];
            for (let style in this.stylePattern.general) {
                let delimiter = this.stylePattern.general[style].source;

                pattern.push(`(?<${style}>${delimiter}.+${delimiter})`);
            }

            for (let style in this.stylePattern.alien) {
                pattern.push(`(?<${style}>${this.stylePattern.alien[style].source})`)
            }
    
            return new RegExp(pattern.join("|"), "g")
        }

        console.error(`${type} is not a vaild parameter for contructRegex(type) from MDpaser`);
        return /[\S\s]*/;
    }

    private Block = {
        p: (props: {raw: String, inlineHTML: Function}) => {
            return (
                <p className="block">
                    {props.inlineHTML(props.raw)}
                </p>
            )
        },
        
        head: (props: {raw: String, inlineHTML: Function}) => {
            const matched = props.raw.match(/(#{1,6} )(.*)/y);
            if (!matched) throw new Error("Unable to match regex within Block component.");

            const HeadingTag = `h${matched[1].length-1}` as "h1" | "h2" |"h3" | "h4" | "h5" | "h6";
            return (
                <HeadingTag className="block">
                    <span>{matched[1]}</span>
                    {props.inlineHTML(matched[2])}
                </HeadingTag>
            );
        },

        check: (props: {raw: String, inlineHTML: Function}) => {
            const matched = props.raw.match(/ - \[(x| )\] (.*)/yi);
            
            const [isChecked, setCheck] = useState(matched[1]==="x" || matched[1]==="X");
            
            return (
                <p className="block">
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setCheck(bool => !bool)}
                    /> 
                    <span>
                        {` - [${(isChecked ? "x" : " ")}] `}
                    </span>
                    {props.inlineHTML(matched[2])}
                </p>
            )
        },

        hr: (props: {raw: String}) => {
            return (
                <div className="block">
                    <hr />
                    <span>{props.raw}</span>
                </div>
            )
        },

        quota: (props: {raw: String, inlineHTML: Function}) => {
            return (
                <blockquote className="block">
                    <span>{"> "}</span>
                    {props.inlineHTML(props.raw.slice(2))}
                </blockquote>
            )
        },

        br: () => {
            return <p className="block"></p>
        }
    }

    private InlineStyle = {
        text: (props: {raw: String}) => {
            return (
                <span>
                    {props.raw}
                </span>
            )
        },
        img: (props: {raw: String}) => {
            const matched = props.raw.match(/!\[(.*)\]\((.+)\)/)
            if (!matched) throw new Error("Unable to match regex within InlineStyle component.");
                
            return (
                <span className="style">
                    <img alt={matched[1]} src={matched[2]}/>
                    <span>{matched[0]}</span>
                </span>
            )
        },
        link: (props: {raw: String}) => {
            const matched = props.raw.match(/(\[)(.*)(\]\((.+)\))/)
            return (
                <a
                    href={matched[4]}
                    className="style"
                    onClick={()=>{window.location.href = "https://"+matched[4]}}
                >
                    <span>{matched[1]}</span>
                    <span>{matched[2]}</span>
                    <span>{matched[3]}</span>
                </a>
            )
        },
        code: (props: {raw: String}) => {
            const delimiter = this.stylePattern.general.code.source;
            const matched = props.raw.match(new RegExp(`(${delimiter})(.+)(${delimiter})`));

            return (
                <code className="style">
                    <span>{matched[1]}</span>
                        {
                            matched[2]
                        }
                    <span>{matched[3]}</span>
                </code>
            )
        },
        general: (props: {Type: inlineStyle, raw: String, inlineHTML: Function}) => {
            const delimiter = this.stylePattern.general[props.Type].source;

            const matched = props.raw.match(new RegExp(`(${delimiter})(.+)(${delimiter})`));
            
            return (
                <props.Type className="style">
                    <span>{matched[1]}</span>
                    {
                        props.inlineHTML(matched[2])
                    }
                    <span>{matched[3]}</span>
                </props.Type>
            )
        }

    }

    private blockHTML(plainText: String) {
        const inlineHTML = (plainText: String) => {
            const regex = this.constructRegex("style");
    
            return [...plainText.matchAll(regex)].map((match, index)=>{
                const style = Object.keys(match.groups).find(a => match.groups[a] !== undefined) as inlineStyle;
                
                const rawText = match.groups[style];
    
                if (this.InlineStyle[style]) {
                    const Tag = this.InlineStyle[style]
    
                    return <Tag key={index} raw={rawText} />;
                }
    
                if (this.stylePattern.general[style]) {
                    return <this.InlineStyle.general key={index} Type={style} raw={rawText} inlineHTML={inlineHTML}/>;
                }
                
                throw new Error(`Unknown regex match type detected. ${style}`)
            })
        }

        let regex = this.constructRegex("block");

        return [...plainText.matchAll(regex)].map((match, index) => {
            const Type = Object.keys(match.groups).filter(a => match.groups[a] !== undefined)[0];
            const rawText = match.groups[Type];

            if (this.Block[Type]) {
                const Tag = this.Block[Type]
                return <Tag key={index} raw={rawText} inlineHTML={inlineHTML} />;
            }
        })
    }

    public parser(plainText: String) {
        if (typeof plainText === "string") {
            return this.blockHTML(plainText);
        }
        return "Error: param is not a string."
    }
}






