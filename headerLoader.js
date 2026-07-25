async function loadHeader() {
    const response = await fetch("components/header.html");
    const html = await response.text();
    document.getElementById("header").innerHTML = html;
    initializeHeader();
}

document.addEventListener("DOMContentLoaded", loadHeader);
