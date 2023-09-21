import React from "react";
import ReactDOM from "react-dom/client";
import {EditorPanel} from "./EditorPanel";

function App() {
    return (
        <>
            <nav>WYSIWYG Markdown Editor</nav>
            <EditorPanel />
        </>
    )
}

const app = ReactDOM.createRoot(document.querySelector("#app"));
app.render(<App />);