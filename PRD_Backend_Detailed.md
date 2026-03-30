# IntelliDesk Backend Development PRD (Product Requirements Document)

## 1. Project Overview
IntelliDesk is an AI-powered customer service management platform designed for cross-border e-commerce. It integrates multi-channel tickets, order information, logistics tracking, and after-sales processing into a unified interface, leveraging AI to enhance agent efficiency.

---

## 2. Functional Modules

### 2.1 Ticket Management
- **Ticket List**: Retrieve tickets with multi-dimensional filtering (Status, Priority, Channel, Sentiment, Tags).
- **Ticket Detail**: 
    - Full conversation history (Messages).
    - Real-time message updates (WebSocket recommended).
    - Internal notes (isInternal: true).
- **Status Workflow**: New -> Todo -> Waiting -> Snoozed -> Resolved.

### 2.2 Order & Logistics Integration
- **Order Synchronization**: Fetch order details from external platforms (e.g., Amazon, Shopify).
- **Logistics Tracking**: Real-time tracking status and event history.
- **Invoice Management**: VAT information display and invoice generation/download.

### 2.3 After-sales Management (Core Enhancement)
- **Separate Flows**:
    - **Refund**: Direct monetary refund without physical return.
    - **Return**: Physical return of goods, followed by refund or exchange.
    - **Exchange**: Return of goods and shipping a replacement.
    - **Reissue**: Shipping a replacement without requiring a return (e.g., for damaged/missing items).
- **Registration**: Link after-sales records to specific Orders and Tickets.
- **Centralized Management**: A dedicated dashboard to track all after-sales statuses.

### 2.4 AI Integration
- **Summarization**: Generate a concise summary of long ticket conversations.
- **Reply Suggestion**: Generate context-aware reply drafts based on ticket content and order status.

---

## 3. Data Models (Entities)

### 3.1 Ticket
| Field | Type | Description |
| :--- | :--- | :--- |
| id | UUID | Unique identifier |
| channelId | UUID | Link to Channel |
| customerId | UUID | Link to Customer |
| orderId | String | Optional link to Order |
| status | Enum | new, todo, waiting, snoozed, resolved, spam |
| priority | Integer | 1-5 (High to Low) |
| sentiment | Enum | angry, anxious, neutral, joyful |
| subject | String | Ticket title/subject |
| tags | Array<String> | Custom labels |
| slaDueAt | Timestamp | SLA deadline |

### 3.2 Message
| Field | Type | Description |
| :--- | :--- | :--- |
| id | UUID | Unique identifier |
| ticketId | UUID | Link to Ticket |
| senderType | Enum | customer, agent, system, ai |
| content | Text | Message body |
| isInternal | Boolean | If true, visible only to agents |
| createdAt | Timestamp | Message time |

### 3.3 AfterSalesRecord
| Field | Type | Description |
| :--- | :--- | :--- |
| id | UUID | Unique identifier |
| orderId | String | Link to Order |
| ticketId | UUID | Link to Ticket |
| type | Enum | refund, return, exchange, reissue |
| status | Enum | submitted, processing, completed, rejected |
| priority | Enum | low, medium, high |
| problemType | String | Category of the issue |
| buyerFeedback | Text | Detailed description from buyer |
| refundAmount | Number | Optional, for refund types |
| refundReason | String | Optional, reason for refund |
| returnTracking | String | Optional, for return/exchange types |
| returnCarrier | String | Optional, carrier for return/exchange types |
| reissueSku | String | Optional, SKU to reissue for exchange/reissue types |
| reissueQuantity | Integer | Optional, quantity to reissue |

---

## 4. API Specification

### 4.1 Tickets API
- `GET /api/tickets`: List tickets with query params (`status`, `priority`, `search`).
- `GET /api/tickets/{id}`: Get ticket details and messages.
- `PATCH /api/tickets/{id}`: Update ticket status, priority, or tags.
- `POST /api/tickets/{id}/messages`: Send a new message or internal note.

### 4.2 Orders & Logistics API
- `GET /api/orders/{id}`: Get detailed order info.
- `GET /api/orders/{id}/logistics`: Get logistics events.

### 4.3 After-sales API
- `GET /api/after-sales`: List all after-sales records with filters.
- `POST /api/after-sales`: Create a new after-sales record.
- `GET /api/after-sales/{id}`: Get specific record details.
- `PATCH /api/after-sales/{id}`: Update status (e.g., from 'submitted' to 'processing').

### 4.4 AI API
- `POST /api/ai/summarize`: Input `ticketId`, output summary string.
- `POST /api/ai/suggest-reply`: Input `ticketId`, output suggested text.

---

## 5. Business Logic & Rules

1. **After-sales Validation**:
    - A refund amount cannot exceed the total order amount.
    - An after-sales record can only be created if the order status is not 'refunded'.
2. **SLA Management**:
    - Tickets must be responded to within the `defaultSlaHours` defined in the Channel.
3. **Permission Control**:
    - `agent`: Can manage tickets and after-sales.
    - `finance`: Can approve/complete refund records.
    - `operations`: Can manage logistics and reissues.
4. **Data Consistency**:
    - When an after-sales record is 'completed' with type 'refund', the corresponding Order's `orderStatus` should be updated to 'refunded'.

---

## 6. Technical Requirements
- **Database**: PostgreSQL (Relational data) + Redis (Caching/Sessions).
- **Real-time**: Socket.io or AWS AppSync for message updates.
- **AI**: Integration with Google Gemini API (Pro/Flash).
- **Search**: Elasticsearch or pg_search for full-text search on messages.
