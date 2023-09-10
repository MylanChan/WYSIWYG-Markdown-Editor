function Image(props) {
    const {raw, alt, src} = props
    
    return (
        <span>
            <img alt={alt} src={src}/>
            <span>{raw}</span>
        </span>
    )
}

export {Image}