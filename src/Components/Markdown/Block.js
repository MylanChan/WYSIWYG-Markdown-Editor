import {useEffect, useState} from "react";

function Heading(props) {
    const {Tag, prefix, innerText} = props;
    return (
        <Tag>
            <span>{prefix}</span>
            {innerText}
        </Tag>
    )
}

function BlockQuota(props) {
    const {innerText} = props;

    return (
        <blockquote className="block">
            <span>{"> "}</span>
            {innerText}
        </blockquote>
    )
}

function CheckBox(props) {
    let {checked, innerText} = props;
    const [isChecked, setCheck] = useState(checked==="x" || checked==="X");
    
    return (
        <p className="block">
            <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {setCheck(bool => !bool)}}
            /> 
            <span>
                {` - [${(isChecked ? "x" : " ")}] `}
            </span>
            {innerText}
        </p>
    )
}
function Hr(props) {
    return (
        <p>
            <span>
                <hr />
                <span>{props.innerText}</span>
            </span>
        </p>
    )
}


export {BlockQuota, CheckBox, Heading, Hr}