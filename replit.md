# Overview

This is an auto warranty/extended service contract platform called "BH Auto Protect" that provides a public-facing quote generation system. The simplified system enables customers to get instant warranty quotes through a multi-step form and submit leads directly through the website without any authentication requirements. This is a streamlined version focused on lead capture and quote generation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React SPA with TypeScript**: Built using Vite for fast development and bundling
- **Routing**: Client-side routing with Wouter for navigation between public and authenticated areas
- **UI Framework**: Radix UI components with shadcn/ui design system and Tailwind CSS for styling
- **State Management**: TanStack Query for server state and API caching, React hooks for local state
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

## Backend Architecture
- **Express.js Server**: RESTful API with TypeScript
- **Authentication**: Replit OAuth integration with session-based auth using Passport.js
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Storage**: PostgreSQL-based session storage with connect-pg-simple
- **API Design**: RESTful endpoints with consistent error handling and request logging

## Data Model Design
- **Normalized Schema**: Comprehensive database schema with proper relationships and foreign keys
- **Lead Management**: Complete lead lifecycle from initial contact through policy binding
- **Vehicle Data**: Detailed vehicle information including VIN, odometer, make/model
- **Quote System**: Multiple plan tiers (Bronze, Silver, Gold)
- **Policy Management**: Full policy lifecycle including payments and documents
- **Audit Trail**: Comprehensive logging of user actions and data changes

## Application Architecture 
- **Public Landing Page**: Professional marketing site with call-to-action for quotes
- **Quote Flow**: Multi-step form for vehicle information and coverage preferences
- **Lead Capture**: Backend API endpoints for processing quote requests and storing leads
- **No Authentication**: Simplified public-only interface without user accounts

# External Dependencies

## Database
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **Drizzle Kit**: Database migrations and schema management

## Simplified Architecture (No Authentication)
- **Public Access**: All pages accessible without login requirements
- **Direct API Access**: Quote and lead submission endpoints available publicly

## UI & Styling
- **Radix UI**: Accessible component primitives for complex UI patterns
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **shadcn/ui**: Pre-built component library built on Radix and Tailwind

## Development Tools
- **Vite**: Build tool with HMR and plugin ecosystem
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast bundling for production builds

## Form Management
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation for form inputs and API requests

## Planned Integrations
- **Stripe**: Payment processing for down payments and recurring billing
- **Twilio**: SMS/WhatsApp messaging for customer communication
- **DocuSign/HelloSign**: E-signature workflow for policy agreements
- **VIN Decoding Service**: Vehicle data validation and enrichment

## SMTP Email Configuration

Transactional emails (such as policy updates sent from the admin panel) use a basic SMTP client. Configure the following environment variables to enable delivery:

- `SMTP_HOST` – Mail server hostname
- `SMTP_PORT` – Mail server port
- `SMTP_USER` / `SMTP_PASS` – Credentials for servers that require authentication
- `SMTP_FROM` – Default "from" address used for outgoing messages
- `SMTP_SECURE` – Set to `true` to connect with implicit TLS (defaults to `true` for port 465)
- `SMTP_STARTTLS` – Set to `true` to upgrade plain connections using STARTTLS (defaults to `true` for port 587)
- `SMTP_TLS_REJECT_UNAUTHORIZED` – Set to `true` to enforce certificate validation (default) or `false` to allow self-signed certificates

Without these settings the application will skip email delivery and return an error when attempting to send.
