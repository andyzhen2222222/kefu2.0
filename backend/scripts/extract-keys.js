import fs from 'fs';

const filePath = 'C:/Users/Administrator/.cursor/projects/e-kefu-2-0/agent-tools/ad99c6e4-6ecf-4db8-a2c8-da25299390d3.txt';
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/Full Response Data: (\{[\s\S]*?\n\})/);
if (match) {
    try {
        const data = JSON.parse(match[1]);
        const order = data.data?.list?.[0];
        if (order) {
            console.log('Order Keys:', Object.keys(order).join(', '));
            console.log('Order Data Sample:', JSON.stringify(order, null, 2));
            
            if (order.items && order.items[0]) {
                console.log('Order Item Keys:', Object.keys(order.items[0]).join(', '));
            }
        } else {
            console.log('No order found in response.');
        }
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
    }
} else {
    console.log('Could not find Full Response Data in file.');
}
