# AI Intelligence Module for Inventory System

## Overview
A lightweight AI Intelligence Engine for Electron + FastAPI inventory system that provides smart inventory management features without external LLM dependencies.

## Core Features

### 1. Duplicate / Anomaly Detection
- **Fuzzy Matching**: Uses rapidfuzz (Levenshtein distance) for name similarity detection
- **Threshold**: 85% similarity threshold (configurable)
- **Actions**: 
  - Shows warning: "Similar product already exists: [existing_product_name]"
  - Asks user: Merge or Create anyway
  - Prevents silent duplicate creation

### 2. Low Stock Intelligence
- **Monitoring**: Continuously monitors stock_quantity from products table
- **Alerts**: Generates alert when stock <= threshold (default: 5)
- **Dashboard**: Shows alerts in AI dashboard widget
- **Configurable**: Threshold can be adjusted via settings

### 3. Natural Language Query System
- **Input Box**: "Ask your system..." chat-style interface
- **Example Queries**:
  - "show low stock items"
  - "which products are running out"
  - "duplicate products list"
  - "top selling products"
- **Intent Parsing**: Keyword-based NLP (no LLM dependency)
- **Query Mapping**: Maps queries to backend functions

### 4. AI Dashboard Widget
- **Low Stock Count**: Real-time count of low stock products
- **Duplicate Warnings**: Shows potential duplicate risks
- **Recent Anomalies**: Lists recent system anomalies
- **Smart Insights**: Provides inventory insights and recommendations

## Backend (FastAPI) Implementation

### Endpoints
- `GET /api/ai/low-stock` - Get low stock products
- `GET /api/ai/duplicates` - Get potential duplicate products
- `POST /api/ai/check-duplicate` - Check duplicate risk for new product
- `GET /api/ai/insights` - Get comprehensive AI insights
- `POST /api/ai/query` - Process natural language query
- `GET /api/ai/dashboard-summary` - Get AI summary for dashboard

### Key Components
1. **AIIntelligenceService** (`backend/services/ai_intelligence_service.py`)
   - Duplicate detection with fuzzy matching
   - Low stock monitoring
   - Natural language query processing
   - AI insights generation

2. **AI Routes** (`backend/routes/ai_intelligence.py`)
   - FastAPI router with all AI endpoints
   - Input validation with Pydantic schemas
   - Database session management

3. **AI Schemas** (`backend/schemas/ai_intelligence.py`)
   - Request/response models
   - Type safety and validation

4. **AI Settings** (`backend/models/ai_setting.py`)
   - Database model for AI configuration
   - Configurable thresholds and settings

## Frontend (Electron + React) Implementation

### Pages
1. **AIIntelligencePage** (`frontend/src/pages/AIIntelligencePage.jsx`)
   - Dashboard tab with AI summary cards
   - Natural language query interface
   - Alerts & insights tab
   - Real-time results panel

2. **AIDashboardWidget** (`frontend/src/components/AIDashboardWidget.jsx`)
   - Compact widget for main dashboard
   - Shows low stock and duplicate counts
   - Quick access to AI features

### Features
- **Three-Tab Interface**:
  - Dashboard: Overview of AI insights
  - Natural Language Query: Chat-style query system
  - Alerts & Insights: Detailed alert management
- **Example Queries**: Pre-built queries for common tasks
- **Real-time Updates**: Auto-refresh for current data
- **Responsive Design**: Works on all screen sizes

## Performance Rules
- **No External LLM**: Uses keyword-based intent detection
- **Fast Response**: < 300ms response time where possible
- **Caching**: Frequent queries cached (low stock, duplicates)
- **Lightweight**: Minimal dependencies (rapidfuzz for fuzzy matching)

## Installation & Setup

### Backend Dependencies
```bash
pip install rapidfuzz==3.10.1
```

Add to `requirements.txt`:
```
rapidfuzz==3.10.1
```

### Database Migration
Run the AI settings migration:
```sql
-- Located at: backend/migrations/012_create_ai_settings.sql
```

### Frontend Updates
1. Added Brain icon to SidebarIcons
2. Added AI Intelligence to navigation menu
3. Added AI Intelligence page route
4. Added AI Dashboard widget to main dashboard

## Configuration

### AI Settings (Database)
Default settings in `ai_settings` table:
- `low_stock_threshold`: 5 (default threshold)
- `duplicate_similarity_threshold`: 0.85 (85% similarity)
- `enable_ai_duplicate_check`: true
- `enable_low_stock_alerts`: true
- `ai_cache_ttl_minutes`: 5

### Integration Points
1. **Product Creation**: Automatic duplicate checking
2. **Dashboard**: AI widget shows real-time alerts
3. **Navigation**: AI Intelligence page in sidebar
4. **API**: All endpoints under `/api/ai/`

## Usage Examples

### Natural Language Queries
```
"show low stock items"
→ Returns products with stock below threshold

"duplicate products list"
→ Returns potential duplicate products

"top selling products"
→ Returns best-selling products by sales count

"system insights"
→ Returns inventory summary and insights
```

### Duplicate Detection
When creating a product named "iPhone 13 Pro":
- Checks for exact matches: "iPhone 13 Pro"
- Checks for similar names: "iPhone13 Pro", "iPhone 13Pro", "Iphone 13 Pro"
- Shows warning if similarity > 85%

### Low Stock Alerts
When product stock reaches 5 or less:
- Appears in AI dashboard widget
- Shows in AI Intelligence page alerts tab
- Included in natural language query results

## Testing
The module includes:
1. **Import Testing**: Verify all imports work
2. **API Testing**: All endpoints return proper responses
3. **Integration Testing**: Works with existing product system
4. **Performance Testing**: Response times under 300ms

## Future Enhancements
1. **Predictive Analytics**: Stock forecasting
2. **Advanced NLP**: More complex query understanding
3. **Machine Learning**: Pattern recognition for anomalies
4. **Integration**: Connect with sales forecasting
5. **Notifications**: Email/SMS alerts for critical stock levels

## Files Created/Modified

### Backend
- `backend/services/ai_intelligence_service.py` - Core AI logic
- `backend/routes/ai_intelligence.py` - API routes
- `backend/schemas/ai_intelligence.py` - Pydantic schemas
- `backend/models/ai_setting.py` - AI settings model
- `backend/migrations/012_create_ai_settings.sql` - Database migration
- `backend/main.py` - Added AI router
- `backend/services/product_service.py` - Added duplicate checking
- `requirements.txt` - Added rapidfuzz dependency

### Frontend
- `frontend/src/pages/AIIntelligencePage.jsx` - Main AI page
- `frontend/src/components/AIDashboardWidget.jsx` - Dashboard widget
- `frontend/src/components/icons/SidebarIcons.jsx` - Added Brain icon
- `frontend/src/config/navigation.js` - Added AI navigation
- `frontend/src/App.jsx` - Added AI route
- `frontend/src/pages/DashboardPage.jsx` - Added AI widget

## Security & Performance
- **No External API Calls**: All processing local
- **Database Efficient**: Uses indexes and optimized queries
- **Input Validation**: All inputs validated with Pydantic
- **Error Handling**: Graceful degradation on errors
- **Caching**: Frequent queries cached to reduce DB load

## License
Part of the Inventory System - Proprietary