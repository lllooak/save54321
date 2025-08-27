// Debug script to test affiliate program join functionality
// Paste this in browser console to test the join button click

console.log('=== Affiliate Join Debug Script ===');

// Find the join button
const buttons = Array.from(document.querySelectorAll('button'));
const joinButton = buttons.find(btn => btn.textContent.includes('הצטרף לתוכנית השותפים'));

if (joinButton) {
    console.log('✅ Found join button:', joinButton);
    console.log('Button disabled:', joinButton.disabled);
    console.log('Button class:', joinButton.className);
    
    // Add event listener to track when button is clicked
    joinButton.addEventListener('click', function() {
        console.log('🔘 Join button clicked!');
        
        // Monitor for state changes by checking if button text changes to loading state
        setTimeout(() => {
            console.log('⏰ After 1s - Button text:', joinButton.textContent);
            console.log('⏰ After 1s - Button disabled:', joinButton.disabled);
        }, 1000);
        
        setTimeout(() => {
            console.log('⏰ After 3s - Button text:', joinButton.textContent);
            console.log('⏰ After 3s - Button disabled:', joinButton.disabled);
            
            // Check if page content has changed (join screen vs dashboard)
            const joinHeader = document.querySelector('h2');
            console.log('⏰ After 3s - Page header:', joinHeader ? joinHeader.textContent : 'No header found');
        }, 3000);
        
        setTimeout(() => {
            console.log('⏰ After 5s - Page content check');
            const pageContent = document.querySelector('.bg-white.rounded-lg.shadow.p-6');
            if (pageContent) {
                console.log('⏰ Page still shows join screen');
                console.log('⏰ Button final state:', joinButton.textContent, 'disabled:', joinButton.disabled);
            } else {
                console.log('⏰ Page has changed - join successful?');
            }
        }, 5000);
    });
    
    console.log('🚀 Click the join button now to see debug output...');
    
} else {
    console.log('❌ Join button not found');
    console.log('Available buttons:', buttons.map(b => ({
        text: b.textContent.trim(),
        class: b.className
    })));
}

// Also check for any React errors or warnings
const originalError = console.error;
const originalWarn = console.warn;

console.error = function(...args) {
    console.log('🔴 Console Error:', ...args);
    originalError.apply(console, args);
};

console.warn = function(...args) {
    console.log('🟡 Console Warning:', ...args);
    originalWarn.apply(console, args);
};

console.log('=== Debug script loaded. Click the join button to test ===');
