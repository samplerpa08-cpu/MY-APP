# Tour Plan Management App

A mobile-first, responsive web application for managing weekly tour plans with secure authentication and Google Sheets backend integration.

## Features

- 📱 **Mobile-First Design**: Optimized for mobile devices with touch-friendly interface
- 🔐 **Secure Authentication**: User login with encrypted password storage
- 📅 **Weekly Plan Management**: Create and manage tour plans for Monday through Sunday
- 👑 **Admin Dashboard**: Comprehensive admin interface with user management and plan oversight
- 📊 **Google Sheets Backend**: Real-time data persistence via Google Sheets API
- 💾 **Offline Support**: Local storage caching with automatic sync when online
- 🔄 **Real-time Sync**: Automatic data synchronization across devices
- 📋 **Copy/Export Features**: Easy data export for external use

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript with modern ES6+ features
- **Backend**: Netlify serverless functions for Google Sheets integration
- **Database**: Google Sheets as the canonical data store
- **Caching**: Local storage for offline functionality
- **Authentication**: Server-side encryption with reversible password storage
- **Deployment**: Netlify with automatic HTTPS and CDN

## Setup Instructions

### 1. Google Sheets Backend Setup

1. **Create Google Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Create service account with Editor role
   - Download the service account JSON key

2. **Share Backend Sheet**:
   ```
   Sheet ID: 1trR2ZjZoiCeSXP-WHyJMyy18f02KZgTdeoseMbuhhR8
   Service Account: myapp-service@myappbackend-468811.iam.gserviceaccount.com
   Permission: Editor
   ```

3. **Sheet Structure**:
   The app will automatically create these sheets:
   - `users` - User accounts and credentials
   - `plans` - Weekly tour plans
   - `custom_locations` - User-defined custom locations
   - `admin_overrides` - Admin week overrides

### 2. Local Development

```bash
# Clone the repository
git clone <repository-url>
cd tour-plan-management-app

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Environment Variables

Create a `.env` file or set these in Netlify:

```env
# Required: Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SHEET_BACKEND_ID=1trR2ZjZoiCeSXP-WHyJMyy18f02KZgTdeoseMbuhhR8

# Required: Security
ENCRYPTION_KEY=your-strong-32-character-key-here
ADMIN_SECRET=your-admin-secret-for-password-decrypt

# Optional: Additional security
NODE_ENV=production
```

### 4. Netlify Deployment

1. **Connect Repository**:
   - Link your GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`

2. **Environment Variables**:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON = {paste full JSON here}
   SHEET_BACKEND_ID = 1trR2ZjZoiCeSXP-WHyJMyy18f02KZgTdeoseMbuhhR8
   ENCRYPTION_KEY = <generate 32-character random key>
   ADMIN_SECRET = <generate strong secret>
   ```

3. **Deploy**:
   - Push to main branch for automatic deployment
   - Or use Netlify CLI: `netlify deploy --prod`

## Usage

### Preset Users

The app comes with these preset users:

- **Sahil Sharma** - Password: 8371
- **Vijay Kumar** - Password: 4926  
- **Pawan Gupta** - Password: 7149
- **Sunil Suri** - Password: 3652
- **Sudhir Kumar** - Password: 9211 (Admin)

### User Features

1. **Login**: Select name from dropdown and enter 4-digit password
2. **My Week**: View and edit weekly tour plan (Monday-Sunday)
3. **Custom Locations**: Add custom locations using "Other" option
4. **Save & Logout**: Save changes and automatically logout

### Admin Features

1. **Dashboard**: View all user plans in table format
2. **Inline Editing**: Click cells to edit any user's plan
3. **User Management**: Add/remove users with password assignment
4. **Copy Features**: 
   - Copy week dates vertically
   - Copy user locations (vertical/horizontal)
5. **Password Access**: View plaintext passwords for users
6. **Week Override**: Manually set different week for planning
7. **Export**: Direct link to Google Sheets for data export

## Technical Details

### Week Computation

The app uses IST (Asia/Kolkata) timezone for consistent week calculations:

```javascript
function computeWeekStartIST(date = new Date(), overrideDateISO = null) {
  // Converts any date to IST and finds Monday of that week
  // Returns: { weekStartId: "YYYYMMDD", headers: [...], dayDates: [...] }
}
```

### Data Persistence

- **Primary**: Google Sheets via Netlify functions
- **Cache**: Browser localStorage for offline access
- **Sync**: Automatic background sync with retry logic
- **Conflict Resolution**: Server data takes precedence

### Security

- **Password Encryption**: AES-192 reversible encryption
- **Service Account**: Secure server-side Google Sheets access
- **Admin Protection**: Secret-based admin endpoint access
- **Input Validation**: All data sanitized and validated

### Offline Functionality

- Service worker caches static assets
- localStorage queues changes when offline
- Automatic sync when connection restored
- Visual indicators for sync status

## API Endpoints

All endpoints are Netlify functions under `/.netlify/functions/`:

- `GET /users` - Get user list
- `POST /login` - User authentication
- `POST /plans/get` - Get week plans
- `POST /plans/set` - Save week plan
- `POST /users/add` - Add new user (admin)
- `POST /users/delete` - Remove user (admin)
- `POST /users/decrypt` - Get plaintext password (admin)
- `POST /custom/add` - Add custom location
- `GET|POST /override` - Manage week overrides

## Browser Support

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile**: iOS Safari 13+, Chrome Mobile 80+
- **Features**: ES2020, Fetch API, LocalStorage, Service Workers
- **Fallbacks**: Graceful degradation for older browsers

## Security Considerations

1. **Service Account JSON**: Never commit to repository
2. **Environment Variables**: Use Netlify's secure environment variable storage
3. **HTTPS Only**: All communication encrypted in transit
4. **Input Validation**: All user inputs sanitized and validated
5. **Admin Access**: Protected by server-side secrets
6. **Password Storage**: Encrypted with strong keys

## Troubleshooting

### Common Issues

1. **Google Sheets Access Denied**:
   - Verify service account email has Editor access to the sheet
   - Check GOOGLE_SERVICE_ACCOUNT_JSON format

2. **Functions Not Working**:
   - Ensure all environment variables are set in Netlify
   - Check function logs in Netlify dashboard

3. **Sync Issues**:
   - Check network connectivity
   - Verify Google Sheets API quotas not exceeded

4. **Mobile Issues**:
   - Ensure viewport meta tag is present
   - Test on actual devices, not just browser dev tools

### Debug Mode

For development, access debug helpers in browser console:

```javascript
window.devHelpers.getAppStatus()  // App status and diagnostics
window.devHelpers.forceSync()     // Force immediate sync
window.devHelpers.clearData()     // Clear all local data
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Create Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check Netlify function logs for backend issues
4. Open GitHub issue with detailed description

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Minimum Node.js**: 18.0.0