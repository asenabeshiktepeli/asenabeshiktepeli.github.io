// ⌨️ Cyber Typewriter Effect
document.addEventListener("DOMContentLoaded", () => {
    // Targets the name inside the "highlight" class in HTML
    const titleElement = document.querySelector(".highlight");
    
    // Starts animation if the element exists on the page
    if (titleElement) {
        const originalText = titleElement.textContent; // Holds the name text
        titleElement.textContent = ""; // Empties it at startup
        
        let index = 0;

        function typeEffect() {
            if (index < originalText.length) {
                titleElement.textContent += originalText.charAt(index);
                index++;
                // 150 milliseconds delay between each character (Typing speed)
                setTimeout(typeEffect, 150);
            }
        }

        // Trigger typing effect with a small initial delay
        setTimeout(typeEffect, 500);
    }
});