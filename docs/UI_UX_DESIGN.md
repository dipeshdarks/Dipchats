# DipChats UI/UX Design Specification

> Version: 1.0.0 | Last Updated: 2026-08-23
> Platforms: Web (React + Vite + Tailwind), Desktop (Tauri), Mobile (React Native)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Design Tokens](#2-design-tokens)
3. [Component Architecture](#3-component-architecture)
4. [Screen Wireframes](#4-screen-wireframes)
5. [Desktop Layout](#5-desktop-layout)
6. [Mobile Layout](#6-mobile-layout)
7. [User Flows](#7-user-flows)
8. [Component Specifications](#8-component-specifications)
9. [Notification Design](#9-notification-design)
10. [Empty States and Error States](#10-empty-states-and-error-states)
11. [Accessibility](#11-accessibility)
12. [Responsive Design](#12-responsive-design)
13. [Animation and Transitions](#13-animation-and-transitions)

---

## 1. Design Principles

### 1.1 Chat-First

Everything revolves around the conversation. The primary action surface is always the
message composer and the active chat. Navigation, file sharing, and settings exist to
support communication, not compete with it. When in doubt, prioritize the chat view.

### 1.2 No Friction

Onboarding is a single field: enter a display name and join. No email, no password, no
phone number, no verification loop. The path from "I want to use DipChats" to "I am
chatting" should take under five seconds. Every additional tap, confirmation, or
configuration screen is a barrier to remove.

### 1.3 Privacy-First

Nothing leaves the device unless the user explicitly sends it. Identity is local and
portable. No accounts to leak, no credentials to breach. Ephemeral messaging is a
first-class mode, not a hidden toggle. The UI should make privacy visible and
controllable at every step.

### 1.4 Offline-Capable

The application must function fully without a network connection. Queued messages,
cached content, local file access, and mesh-based local communication all work
offline. The UI communicates connectivity state clearly but never locks the user out
of functionality.

### 1.5 Mobile-First

Design for the smallest screen and most constrained input first. Every feature must
work on a phone held in one hand with a thumb. Desktop and tablet layouts are
enhancements, not separate products. The mobile experience is the baseline.

### 1.6 Simplicity with Depth

Surface the most important actions immediately. Provide power-user features through
progressive disclosure. A new user should feel comfortable in seconds. An advanced
user should feel powerful in minutes.

---

## 2. Design Tokens

### 2.1 Color Palette

#### Dark Mode (Default)

| Token               | Value       | Usage                          |
|----------------------|-------------|--------------------------------|
| `bg-primary`         | `#0a0a0f`   | App background                 |
| `bg-secondary`       | `#12121a`   | Sidebar, panels                |
| `bg-tertiary`        | `#1a1a25`   | Cards, elevated surfaces       |
| `bg-hover`           | `#222230`   | Hover states                   |
| `bg-active`          | `#2a2a3a`   | Active/selected states         |
| `bg-message-own`     | `#2d4a7a`   | Own message bubble             |
| `bg-message-other`   | `#1e1e2e`   | Other message bubble           |
| `bg-input`           | `#16161f`   | Text input fields              |
| `bg-modal`           | `#1a1a25`   | Modal overlays                 |
| `bg-toast`           | `#1e1e2e`   | Toast notifications            |
| `text-primary`       | `#e8e8f0`   | Primary text                   |
| `text-secondary`     | `#8888a0`   | Secondary text, labels         |
| `text-tertiary`      | `#555570`   | Placeholder text               |
| `text-inverse`       | `#0a0a0f`   | Text on accent backgrounds     |
| `accent-primary`     | `#4a90d9`   | Primary actions, links         |
| `accent-success`     | `#34c759`   | Success, online indicators     |
| `accent-warning`     | `#ffb340`   | Warnings, partial states       |
| `accent-danger`      | `#ff3b5c`   | Errors, destructive actions    |
| `accent-info`        | `#5ac8fa`   | Informational badges           |
| `border-default`     | `#2a2a3a`   | Standard borders               |
| `border-subtle`      | `#1e1e2e`   | Subtle dividers                |
| `border-focus`       | `#4a90d9`   | Focus rings                    |
| `overlay-backdrop`   | `rgba(0,0,0,0.6)` | Modal backdrop           |

#### Light Mode

| Token               | Value       | Usage                          |
|----------------------|-------------|--------------------------------|
| `bg-primary`         | `#ffffff`   | App background                 |
| `bg-secondary`       | `#f5f5f7`   | Sidebar, panels                |
| `bg-tertiary`        | `#eaeaef`   | Cards, elevated surfaces       |
| `bg-hover`           | `#e0e0e8`   | Hover states                   |
| `bg-active`          | `#d0d0da`   | Active/selected states         |
| `bg-message-own`     | `#d4e4f7`   | Own message bubble             |
| `bg-message-other`   | `#f0f0f5`   | Other message bubble           |
| `bg-input`           | `#f5f5f7`   | Text input fields              |
| `bg-modal`           | `#ffffff`   | Modal overlays                 |
| `bg-toast`           | `#f5f5f7`   | Toast notifications            |
| `text-primary`       | `#1a1a2e`   | Primary text                   |
| `text-secondary`     | `#6b6b80`   | Secondary text, labels         |
| `text-tertiary`      | `#9999a8`   | Placeholder text               |
| `text-inverse`       | `#ffffff`   | Text on accent backgrounds     |
| `accent-primary`     | `#3a7bc8`   | Primary actions, links         |
| `accent-success`     | `#28a745`   | Success, online indicators     |
| `accent-warning`     | `#e6a23c`   | Warnings, partial states       |
| `accent-danger`      | `#dc3545`   | Errors, destructive actions    |
| `accent-info`        | `#17a2b8`   | Informational badges           |
| `border-default`     | `#d0d0d8`   | Standard borders               |
| `border-subtle`      | `#eaeaef`   | Subtle dividers                |
| `border-focus`       | `#3a7bc8`   | Focus rings                    |
| `overlay-backdrop`   | `rgba(0,0,0,0.3)` | Modal backdrop           |

### 2.2 Typography

| Token             | Font Family                           | Size   | Weight | Line Height | Use Case                |
|--------------------|---------------------------------------|--------|--------|-------------|-------------------------|
| `heading-1`        | Inter, -apple-system, sans-serif      | 28px   | 700    | 1.2         | Screen titles           |
| `heading-2`        | Inter, -apple-system, sans-serif      | 22px   | 600    | 1.3         | Section headings        |
| `heading-3`        | Inter, -apple-system, sans-serif      | 18px   | 600    | 1.3         | Subsection headings     |
| `body`             | Inter, -apple-system, sans-serif      | 14px   | 400    | 1.5         | Body text               |
| `body-medium`      | Inter, -apple-system, sans-serif      | 14px   | 500    | 1.5         | Emphasized body text    |
| `body-bold`        | Inter, -apple-system, sans-serif      | 14px   | 600    | 1.5         | Strong body text        |
| `caption`          | Inter, -apple-system, sans-serif      | 12px   | 400    | 1.4         | Timestamps, labels      |
| `caption-medium`   | Inter, -apple-system, sans-serif      | 12px   | 500    | 1.4         | Badge labels            |
| `small`            | Inter, -apple-system, sans-serif      | 11px   | 400    | 1.3         | Micro labels            |
| `mono`             | JetBrains Mono, monospace             | 13px   | 400    | 1.5         | Code blocks, IDs        |
| `message-text`     | Inter, -apple-system, sans-serif      | 14px   | 400    | 1.5         | Chat messages           |
| `message-name`     | Inter, -apple-system, sans-serif      | 13px   | 600    | 1.2         | Sender name in chat     |
| `input`            | Inter, -apple-system, sans-serif      | 15px   | 400    | 1.4         | Text inputs             |

### 2.3 Spacing Scale

| Token      | Value | Use Case                          |
|------------|-------|-----------------------------------|
| `space-0`  | 0px   | Reset                             |
| `space-1`  | 4px   | Micro gaps, icon padding          |
| `space-2`  | 8px   | Tight spacing, inline elements    |
| `space-3`  | 12px  | Small padding, compact lists      |
| `space-4`  | 16px  | Standard padding, card padding    |
| `space-5`  | 20px  | Section spacing                   |
| `space-6`  | 24px  | Large padding, section gaps       |
| `space-8`  | 32px  | Major section breaks              |
| `space-10` | 40px  | Screen-level padding              |
| `space-12` | 48px  | Large screen margins              |
| `space-16` | 64px  | Hero spacing                      |

### 2.4 Shadows

| Token           | Value                                    | Use Case          |
|------------------|------------------------------------------|--------------------|
| `shadow-sm`      | `0 1px 2px rgba(0,0,0,0.15)`           | Subtle lift        |
| `shadow-md`      | `0 4px 8px rgba(0,0,0,0.2)`            | Cards, dropdowns   |
| `shadow-lg`      | `0 8px 24px rgba(0,0,0,0.25)`          | Modals, popovers   |
| `shadow-xl`      | `0 16px 48px rgba(0,0,0,0.3)`          | Floating panels    |
| `shadow-glow`    | `0 0 12px rgba(74,144,217,0.3)`        | Focus glow         |

### 2.5 Border Radius

| Token         | Value  | Use Case                          |
|---------------|--------|-----------------------------------|
| `radius-none` | 0px    | No rounding                       |
| `radius-sm`   | 4px    | Subtle rounding, tags             |
| `radius-md`   | 8px    | Buttons, inputs, cards            |
| `radius-lg`   | 12px   | Modals, panels                    |
| `radius-xl`   | 16px   | Message bubbles                   |
| `radius-2xl`  | 24px   | Avatar circles                    |
| `radius-full` | 9999px | Pills, badges                     |

### 2.6 Z-Index Scale

| Token          | Value | Use Case                          |
|----------------|-------|-----------------------------------|
| `z-base`       | 0     | Base layer                        |
| `z-dropdown`   | 100   | Dropdowns, context menus          |
| `z-sticky`     | 200   | Sticky headers, floating elements |
| `z-overlay`    | 300   | Modal overlays                    |
| `z-modal`      | 400   | Modal content                     |
| `z-toast`      | 500   | Toast notifications               |
| `z-tooltip`    | 600   | Tooltips                          |

---

## 3. Component Architecture

```
App
+-- Provider
|   +-- ThemeProvider
|   +-- IdentityProvider (local identity, no login)
|   +-- NetworkProvider (mesh, relay, offline)
|   +-- NotificationProvider
|
+-- Router
|   +-- OnboardingRoute (JoinScreen)
|   +-- AuthenticatedRoute
|       +-- DesktopShell
|       |   +-- Sidebar
|       |   |   +-- NavItem (Chats, Channels, DM, Mesh, Files, Settings)
|       |   |   +-- ConnectionStatus
|       |   |   +-- UserAvatar (bottom)
|       |   +-- ChatListPanel
|       |   |   +-- SearchBar
|       |   |   +-- FilterTabs (All, Unread, Mentions)
|       |   |   +-- ChatListItem (repeating)
|       |   |   +-- EmptyState
|       |   +-- ActiveChatPanel
|       |       +-- ChatHeader
|       |       |   +-- ChatTitle
|       |       |   +-- MemberCount
|       |       |   +-- HeaderActions (search, pin, mute, more)
|       |       +-- MessageList
|       |       |   +-- DateSeparator
|       |       |   +-- MessageGroup
|       |       |   |   +-- Avatar
|       |       |   |   +-- SenderName
|       |       |   |   +-- MessageBubble (repeating)
|       |       |   |       +-- TextContent
|       |       |   |       +-- FileAttachment
|       |       |   |       +-- ImageAttachment
|       |       |   |       +-- ReactionBar
|       |       |   |       +-- MessageStatus (sent, delivered, read)
|       |       |   +-- TypingIndicator
|       |       +-- MessageComposer
|       |           +-- AttachButton
|       |           +-- TextInput
|       |           +-- EmojiButton
|       |           +-- SendButton
|       |
|       +-- MobileShell
|       |   +-- ScreenStack
|       |   +-- BottomNav
|       |       +-- NavTab (Chats, Channels, Mesh, Files, More)
|       |
|       +-- Screens
|       |   +-- ChatsScreen
|       |   +-- ChannelsScreen
|       |   +-- DMScreen
|       |   +-- MeshScreen
|       |   +-- FilesScreen
|       |   +-- SettingsScreen
|       |   +-- UserProfileScreen
|       |   +-- DeviceManagementScreen
|       |   +-- ChannelBrowserScreen
|       |
|       +-- SharedComponents
|           +-- Modal / BottomSheet
|           +-- Toast
|           +-- ContextMenu
|           +-- Avatar
|           +-- Badge
|           +-- Button
|           +-- Input
|           +-- Toggle
|           +-- Dropdown
|           +-- Tooltip
|           +-- Skeleton
|           +-- Spinner
```

## 4. Screen Wireframes

### 4.1 Join / Onboarding Screen

The simplest possible entry point. One field, one button. No friction.

`
+--------------------------------------------------+
|                                                  |
|                                                  |
|                  (logo/icon)                     |
|                                                  |
|              D I P C H A T S                     |
|                                                  |
|          local mesh messaging                    |
|                                                  |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |  Enter your display name...                |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |               Join Now                     |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|                                                  |
|      Your identity stays on your device.         |
|      No account required.                        |
|                                                  |
|                                                  |
+--------------------------------------------------+
`

**Behavior:**
- Display name field is auto-focused on load
- Placeholder: "Enter your display name..."
- Validation: 1-32 characters, no empty strings
- "Join Now" button is disabled until name is entered
- On submit: generate local identity, store in device, navigate to Home
- No loading spinner needed -- identity generation is instant

---

### 4.2 Home Screen -- Desktop Layout

`
+----------+----------------+-------------------------------+
|          |                |                               |
| SIDEBAR  |   CHAT LIST    |        ACTIVE CHAT            |
|          |                |                               |
| +------+ | +------------+ | +---------------------------+ |
| |      | | | Search...  | | |  #general                 | |
| +------+ | +------------+ | |  24 members                | |
|          |                | +---------------------------+ |
| +------+ | [All][Unread] | |                           | |
| |      | |                | |  Alice  10:32 AM          | |
| +------+ | +------------+ | |  Hey everyone, how is it  | |
|          | | un-read    | |  going?                    | |
| +------+ | |   [badge]  | |                           | |
| |      | | +------------+ |  Bob   10:34 AM            | |
| +------+ |                | |  Going great! Just set up | |
|          | +------------+ |  my mesh node.             | |
| +------+ | | #general   | |                           | |
| |      | | |  last msg  | |  You  10:36 AM            | |
| +------+ | +------------+ | |  Nice! Connected from     | |
|          |                | |  3 devices.               | |
| +------+ | +------------+ | |                           | |
| |      | | | #random    | |                           | |
| +------+ | |  last msg  | |                           | |
|          | +------------+ |                           | |
|          |                |                           | |
|          | +------------+ |                           | |
|          | | DM: Alice  | |                           | |
|          | |  last msg  | |                           | |
|          | +------------+ |                           | |
|          |                |                           | |
|          |                +---------------------------+ |
|          |                | [+] Type a message...   [>] |
|          |                +---------------------------+ |
|          |                                              |
|  [gear]  |                                              |
|  Online  |                                              |
+----------+----------------+-------------------------------+
`

**Sidebar (56px wide):**
- App icon/logo at top
- Navigation icons stacked vertically: Chats, Channels, DM, Mesh, Files
- Divider
- Settings gear at bottom
- User avatar with online indicator at very bottom
- Active nav item has accent-primary left border indicator and bg-hover background
- Tooltips appear on hover showing section name

**Chat List Panel (280px wide):**
- Search bar at top with magnifying glass icon
- Filter tabs: All | Unread | Mentions
- Scrollable list of conversations
- Each item: avatar, name, last message preview, timestamp, unread badge
- Active conversation has bg-active background
- Right-click context menu: Mute, Pin, Mark Unread, Archive, Leave

**Active Chat Panel (remaining width):**
- Chat header with name, member count, action icons
- Scrollable message list
- Message composer at bottom
---

### 4.3 Home Screen -- Mobile Layout

`
+----------------------------------+
|  (hamburger)   Chats      (+)   |
+----------------------------------+
|  +----------------------------+  |
|  | [Search conversations...]  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  [A] #general              |  |
|  |      Bob: Nice setup!  2m  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  [B] #random               |  |
|  |      Alice: lol    15m     |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  [C] DM: Charlie           |  |
|  |      See you later  1h     |  |
|  |                     [3]    |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  [D] #dev                  |  |
|  |      Merged the PR   3h    |  |
|  +----------------------------+  |
|                                  |
|                                  |
+----------------------------------+
|  [chat]  [channel]  [mesh]  [+] |
+----------------------------------+
`

**Bottom Navigation (4-5 tabs):**
- Chats (default, badge shows total unread)
- Channels
- Mesh (or Files depending on priority)
- More (overflow: Settings, Files, Profile)
- Active tab: accent-primary icon + label
- Inactive tab: text-secondary icon only (label on tap on iOS)

---

### 4.4 Active Chat / Conversation View -- Desktop

`
+-----------------------------------------------------------+
|  [<]  #general                 24 members    [S] [P] [M] |
+-----------------------------------------------------------+
|                                                           |
|  ---- Today ----                                          |
|                                                           |
|        Alice                              10:32 AM        |
|     +----------------------------------------+            |
|     | Hey everyone! Just got DipChats set   |            |
|     | up on all my devices.                  |            |
|     +----------------------------------------+            |
|                                                           |
|        Bob                                10:34 AM        |
|     +----------------------------------------+            |
|     | Nice! I am connected via mesh from     |            |
|     | the coffee shop. Latency is great.    |            |
|     +----------------------------------------+            |
|     | +----+ +----+                           |            |
|     | |wifi| |mesh|  2 reactions              |            |
|     | +----+ +----+                           |            |
|     +----------------------------------------+            |
|                                                           |
|        You                                  10:36 AM     |
|                +----------------------------------------+  |
|                | Awesome. I am sharing a file from my  |  |
|                | phone directly to the desktop.        |  |
|                +----------------------------------------+  |
|                | [image_preview.png]                     |  |
|                | 2.4 MB                                 |  |
|                +----------------------------------------+  |
|                              [done] [check]    10:36 AM   |
|                                                           |
|        Charlie                              10:38 AM      |
|     +----------------------------------------+            |
|     | Quick question - can we use channels   |            |
|     | for the project updates?               |            |
|     +----------------------------------------+            |
|                                                           |
|                                                           |
+-----------------------------------------------------------+
| [+] [GIF]  Type a message...                     [>] [ ] |
+-----------------------------------------------------------+
`

**Chat Header:**
- Back button (mobile only)
- Channel/chat name (bold)
- Member count or "Direct Message" subtitle
- Search icon -- opens in-chat search
- Pin icon -- pin important messages
- Mute icon -- toggle notifications
- More menu (...) -- channel settings, members, leave

**Message List:**
- Auto-scrolls to bottom on new messages
- "New messages" indicator when scrolled up
- Date separators between days
- Messages grouped by sender (consecutive messages from same person)
- Own messages aligned right with accent-primary background
- Others aligned left with bg-message-other background
- Each message: avatar (if new group), sender name (if new group), timestamp, content
- Reactions shown below message in pill format
- Message status indicator: sending > sent > delivered > read
- Long-press / right-click: Reply, React, Copy, Forward, Delete, Pin

**Message Composer:**
- Plus button -- attach file, image, location
- GIF button -- GIF picker
- Text input -- auto-expanding textarea (min 1 line, max 8 lines)
- Send button -- appears when text is entered, animated on send
- Emoji picker button
- Typing indicator above composer when others are typing

---

### 4.5 Active Chat / Conversation View -- Mobile

`
+----------------------------------+
| [<]  #general            [S][M] |
+----------------------------------+
|                                  |
|  ---- Today ----                 |
|                                  |
|    Alice              10:32 AM   |
|  +---------------------------+  |
|  | Hey everyone! Just got    |  |
|  | DipChats set up.          |  |
|  +---------------------------+  |
|                                  |
|    Bob              10:34 AM    |
|  +---------------------------+  |
|  | Nice! Connected via mesh  |  |
|  | from the coffee shop.     |  |
|  +---------------------------+  |
|  [wifi] [mesh]                  |
|                                  |
|             You       10:36 AM  |
|          +---------------------+|
|          | Sharing a file from ||
|          | my phone.           ||
|          +---------------------+|
|          | [image_preview.png] ||
|          | 2.4 MB              ||
|          +---------------------+|
|                    [done]  [v]  |
|                                  |
|    Charlie          10:38 AM    |
|  +---------------------------+  |
|  | Can we use channels for   |  |
|  | project updates?          |  |
|  +---------------------------+  |
|                                  |
+----------------------------------+
| [+]  Type a message...     [>] |
+----------------------------------+
`

**Mobile Differences:**
- Back arrow in header returns to chat list
- Composer is fixed at bottom, above keyboard
- Attach button expands to bottom sheet with options
- Swipe right on message to reply
- Swipe left to react with default emoji
- Pull down to load older messages (shows spinner)
- Full-screen image viewer on tap
---

### 4.6 Channel Browser

`
+-----------------------------------------------------------+
|  [<]  Channels                                      [+]   |
+-----------------------------------------------------------+
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Search channels...]                             |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Toggle: My Channels  |  Browse All]             |   |
|  +---------------------------------------------------+   |
|                                                           |
|  MY CHANNELS                                              |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #general                      24 members   [->]  |   |
|  |  General discussion for everyone                   |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #dev-team                    8 members    [->]   |   |
|  |  Development discussions and PR reviews            |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #random                      24 members   [->]   |   |
|  |  Off-topic chat and fun stuff                      |   |
|  +---------------------------------------------------+   |
|                                                           |
|  BROWSE ALL                                               |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #announcements              50 members    [Join]  |   |
|  |  Official announcements and updates                |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #events                     31 members    [Join]  |   |
|  |  Community events and meetups                      |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Create New Channel]                               |   |
|  +---------------------------------------------------+   |
|                                                           |
+-----------------------------------------------------------+
`

---

### 4.7 Create Channel Modal

`
+-----------------------------------------------------------+
|                                                           |
|     Create Channel                                   [X]  |
|                                                           |
|  +---------------------------------------------------+   |
|  |  Channel Name                                     |   |
|  |  [my-new-channel                          ]       |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  Description (optional)                            |   |
|  |  [What is this channel about?               ]     |   |
|  |  [                                               ] |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  Visibility                                        |   |
|  |  (o) Public - Anyone can find and join              |   |
|  |  ( ) Private - Invite only                         |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  Ephemeral Messages                                |   |
|  |  [Toggle: Off]  Messages persist indefinitely      |   |
|  |                                                    |   |
|  |  When enabled, messages auto-delete after:         |   |
|  |  [1 hour] [6 hours] [24 hours] [7 days]           |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------+  +---------------------+   |
|  |       Cancel              |  |    Create Channel   |   |
|  +---------------------------+  +---------------------+   |
|                                                           |
+-----------------------------------------------------------+
`

---

### 4.8 Direct Messages

`
+-----------------------------------------------------------+
|  [<]  Direct Messages                              [+]    |
+-----------------------------------------------------------+
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Search messages or people...]                    |   |
|  +---------------------------------------------------+   |
|                                                           |
|  ONLINE                                                   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [A] Alice                              online    |   |
|  |      Sure, I will send it over in a bit           |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [B] Bob                                 online    |   |
|  |      The mesh is working great today               |   |
|  +---------------------------------------------------+   |
|                                                           |
|  OFFLINE                                                  |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [C] Charlie                            2h ago     |   |
|  |      Talk to you tomorrow                          |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [D] Dana                               1d ago     |   |
|  |      Thanks for the file!                          |   |
|  +---------------------------------------------------+   |
|                                                           |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Start New Conversation]                           |   |
|  +---------------------------------------------------+   |
|                                                           |
+-----------------------------------------------------------+
`

**Start New Conversation flow:**
- Tap "+" or "Start New Conversation"
- Shows contact list with search
- Tap a name to open DM conversation
- If no existing conversation, creates one
- No friend request or approval -- just start chatting

---

### 4.9 Mesh Network View

`
+-----------------------------------------------------------+
|  [<]  Mesh Network                                [?]     |
+-----------------------------------------------------------+
|                                                           |
|  +---------------------------------------------------+   |
|  |  YOUR NODE                                        |   |
|  |  Status: Online                                   |   |
|  |  Node ID: dip-mesh-a3f8k2                        |   |
|  |  Connected peers: 3                               |   |
|  |  [Share Node ID]                                  |   |
|  +---------------------------------------------------+   |
|                                                           |
|  CONNECTED PEERS                                           |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [A] Alice's Phone            mesh     [4 bars]   |   |
|  |      Last seen: 2 min ago                         |   |
|  |      Relay: Direct                                |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [B] Bob's Laptop             mesh     [3 bars]   |   |
|  |      Last seen: 5 min ago                         |   |
|  |      Relay: Via Alice                             |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [C] Charlie's Desktop        relay    [2 bars]   |   |
|  |      Last seen: 12 min ago                        |   |
|  |      Relay: Internet                              |   |
|  +---------------------------------------------------+   |
|                                                           |
|  DISCOVERED NODES                                         |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [D] Unknown Node             mesh     [1 bar]    |   |
|  |      Last seen: 30 min ago                        |   |
|  |      [Connect]                                    |   |
|  +---------------------------------------------------+   |
|                                                           |
|  MESH TOPOLOGY                                            |
|                                                           |
|     [You]----[Alice]----[Bob]                             |
|       |                   |                               |
|       +----[Charlie]------+                               |
|                                                           |
|                                                           |
+-----------------------------------------------------------+
`

**Mesh View Details:**
- Shows local node status prominently
- Lists connected peers with signal strength indicator
- Signal: 5 bars = excellent, 4 = good, 3 = fair, 2 = weak, 1 = poor
- Relay type: Direct (mesh), Via [name] (multi-hop), Internet (relay server)
- Discovered but unconnected nodes show "Connect" button
- Mesh topology diagram shows visual network map
- Pull to refresh peer list

---

### 4.14 Channel Info / Settings

```
+-----------------------------------------------------------+
|  [<]  #dev-team                                    [>]   |
+-----------------------------------------------------------+
|                                                           |
|               +--------+                                  |
|               | #      |                                  |
|               | avatar |                                  |
|               +--------+                                  |
|                                                           |
|              dev-team                                     |
|              Development discussions and PR reviews        |
|                                                           |
|  +---------------------------------------------------+   |
|  |  MEMBERS                              8 members   |   |
|  |  +-------------------------------------------+     |   |
|  |  | [A] Alice                  online        |     |   |
|  |  | [B] Bob                     online        |     |   |
|  |  | [C] Charlie                 2h ago        |     |   |
|  |  | [D] Dana                    1d ago        |     |   |
|  |  | [View all 8 members]                     |     |   |
|  |  +-------------------------------------------+     |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  PINNED MESSAGES                     3 pinned     |   |
|  |  +-------------------------------------------+     |   |
|  |  | Alice: Meeting notes from standup...      |     |   |
|  |  | Bob: PR 42 is ready for review...         |     |   |
|  |  | Charlie: Sprint goals document...         |     |   |
|  |  +-------------------------------------------+     |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  SETTINGS                                         |   |
|  |  Mute Notifications             [Toggle: Off]    |   |
|  |  Ephemeral Messages             [Toggle: Off]    |   |
|  |  Auto-Delete Files              [Never  v]       |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  SHARED FILES                       12 files     |   |
|  |  [View All]                                    |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  [Leave Channel]                     [Red Text]  |   |
|  +---------------------------------------------------+   |
|                                                           |
+-----------------------------------------------------------+
```

---

### 4.15 Search View (Global)

```
+-----------------------------------------------------------+
|  [X]  Search messages...                          [Cancel]|
+-----------------------------------------------------------+
|                                                           |
|  RECENT SEARCHES                                          |
|  +---------------------------------------------------+   |
|  |  mesh configuration                    2h ago     |   |
|  |  file sharing                          1d ago     |   |
|  |  project deadline                      3d ago     |   |
|  +---------------------------------------------------+   |
|                                                           |
|  FILTER                                                   |
|  +---------------------------------------------------+   |
|  |  [All] [Messages] [Files] [Channels] [People]     |   |
|  +---------------------------------------------------+   |
|                                                           |
|  SEARCH RESULTS                                           |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #general - Alice                           10:32  |   |
|  |  Hey everyone, just got mesh set up...            |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  #dev-team - Bob                             9:15  |   |
|  |  The mesh latency is looking good today.          |   |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  |  DM: Charlie                                4:20   |   |
|  |  Can you check the mesh topology?                 |   |
|  +---------------------------------------------------+   |
|                                                           |
+-----------------------------------------------------------+
```

---

### 4.16 Emoji Picker

```
+-------------------------------+
|  [Search emoji...]            |
+-------------------------------+
|  [Frequent] [Smileys] [Gestures] [Hearts] |
+-------------------------------+
|                               |
|  [grin] [wink] [laugh] [rofl] [smile]  |
|  [happy] [sweat] [laugh2] [wink2] [blush]|
|  [yum] [cool] [heart-eyes] [love] [kiss]|
|  [pensive] [unamused] [disappointed] [confused] [neutral] |
|  [rolling-eyes] [smirk] [persevere] [disappointed-relieved] [open-mouth] |
|  [zipper-mouth] [hushed] [sleepy] [tired] [yawning] |
|  [sleeping] [relieved] [yum2] [drooling] [yum3] |
|  [thinking] [slight-frown] [confused2] [expressionless] [no-mouth] |
|                               |
|  RECENTLY USED                |
|  [thumbs-up] [heart] [fire] [check] [laugh] |
|                               |
+-------------------------------+
```

---

### 4.17 Context Menu (Right-Click / Long-Press)

```
+-------------------------------+
|  Reply                        |
|  React                        |
|  Copy Text                    |
|  Forward...                   |
|  Pin Message                  |
|  Edit Message         (own)   |
|  Delete Message               |
|  Report                       |
+-------------------------------+
```

---

### 4.18 Image Viewer (Full Screen)

```
+-----------------------------------------------------------+
|  [X]                                [Download] [Share]    |
+-----------------------------------------------------------+
|                                                           |
|                                                           |
|                                                           |
|                                                           |
|                                                           |
|              +---------------------------+                |
|              |                           |                |
|              |                           |                |
|              |      IMAGE PREVIEW        |                |
|              |                           |                |
|              |                           |                |
|              +---------------------------+                |
|                                                           |
|                                                           |
|                                                           |
|                                                           |
|                                                           |
|  Shared in #general by Alice at 10:36 AM                  |
|  2048 x 1024 | 2.4 MB                                    |
|                                                           |
+-----------------------------------------------------------+
```

---

### 4.19 Toast Notifications

```
Success Toast:
+------------------------------------------+
|  [check]  Message sent successfully  [X] |
+------------------------------------------+

Error Toast:
+------------------------------------------+
|  [!]  Failed to send. Tap to retry.  [X] |
+------------------------------------------+

Info Toast:
+------------------------------------------+
|  [i]  New message from Alice         [X] |
+------------------------------------------+

Warning Toast:
+------------------------------------------+
|  [!]  You are in offline mode.       [X] |
+------------------------------------------+
```

---

### 4.20 Modal / Bottom Sheet

**Desktop Modal:**
```
+-----------------------------------------------------------+
|  overlay-backdrop                                         |
|                                                           |
|     +-----------------------------------------------+     |
|     |  Modal Title                           [X]   |     |
|     +-----------------------------------------------+     |
|     |                                               |     |
|     |  Modal content goes here.                     |     |
|     |                                               |     |
|     |                                               |     |
|     +-----------------------------------------------+     |
|     |                                               |     |
|     |  [Cancel]                    [Confirm]        |     |
|     |                                               |     |
|     +-----------------------------------------------+     |
|                                                           |
+-----------------------------------------------------------+
```

**Mobile Bottom Sheet:**
```
+----------------------------------+
|           (drag handle)          |
+----------------------------------+
|                                  |
|  Sheet Title                     |
|                                  |
|  +----------------------------+  |
|  |  Option 1                  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  Option 2                  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  Option 3                  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  |  Cancel (red)              |  |
|  +----------------------------+  |
|                                  |
+----------------------------------+
```

---

### 4.21 Unread Badge

```
Compact badge:    [3]
Large badge:      [99+]
Mention badge:    [@3]
```

- Appears on chat list items, nav tabs, and channel items
- Red background (accent-danger) with white text
- Positions: top-right of icon or far-right of list item
- Animate in with scale + fade

---

### 4.22 Connection Status Bar

```
Online (default):     (no bar shown)
Offline:              +----------------------------------+
                      | [!] Offline - messages will be   |
                      | queued and sent when online  [X] |
                      +----------------------------------+

Weak connection:      +----------------------------------+
                      | [~] Unstable connection          |
                      +----------------------------------+

Connecting:           +----------------------------------+
                      | [o] Reconnecting...              |
                      +----------------------------------+
```

- Positioned below the chat header (inline) or at top of app (global)
- Background: accent-warning for offline, accent-danger for disconnected
- Auto-dismisses when connection is restored
- Persistent for offline mode (cannot be dismissed)

---

### 4.23 Typing Indicator

```
+-------------------------------+
|  Alice is typing...           |
|  (three animated dots)        |
+-------------------------------+
```

- Appears above the message composer
- Shows up to 2 names: "Alice is typing..." or "Alice and Bob are typing..."
- Three dots animate in a wave pattern
- Disappears 3 seconds after last keystroke

---

### 4.24 Message Status Indicators

```
Sending:    [clock icon]     - gray, animated
Sent:       [single check]   - gray
Delivered:  [double check]   - gray
Read:       [double check]   - accent-primary (blue)
Failed:     [!] red          - tap to retry
```

---

### 4.25 Skeleton Loading States

```
Chat List Skeleton:
+--------------------------------------------+
|  [Avatar]  [=========]                    |
|            [====]                         |
+--------------------------------------------+
|  [Avatar]  [========]                     |
|            [===]                          |
+--------------------------------------------+

Message Skeleton:
+--------------------------------------------+
|  [Avatar]  [Name]                         |
|            [==================]            |
|            [========]                      |
+--------------------------------------------+
```

- Animated shimmer effect (gradient slide)
- Matches exact layout of real content
- Shows on initial load or when refreshing
- Replaced by real content as data streams in


---

## 5. Desktop Layout

### 5.1 Three-Panel Architecture

The desktop layout uses a three-panel system: sidebar, chat list, and active chat.
This mirrors the proven pattern from Discord, Slack, and Telegram Desktop.

```
+----------+----------------+-------------------------------+
|          |                |                               |
|  56px    |    280px       |        flex: 1                |
|          |                |                               |
| SIDEBAR  |   CHAT LIST    |        ACTIVE CHAT            |
|          |                |                               |
+----------+----------------+-------------------------------+
```

**Panel Resize Rules:**
- Sidebar: fixed at 56px, no resize
- Chat list: min 240px, max 400px, resizable by dragging edge
- Active chat: fills remaining space, min 400px
- Below 1200px total width: collapse chat list to overlay on hover
- Below 900px total width: use mobile layout (bottom nav)

### 5.2 Sidebar Behavior

```
Collapsed (default):     Expanded (hover):
+--------+                +--------+
|  [##]  |                |  [##]  |
|        |                |        |
|  [C]   |  --> hover     |  Chats |
|  [D]   |  --> expand    |  Channels|
|  [M]   |                |  DM    |
|  [F]   |                |  Mesh  |
|        |                |  Files |
|        |                |        |
|  ----  |                |  ----  |
|  [S]   |                |  [S]   |
|  [A]   |                |  [A]   |
+--------+                +--------+
  56px                      56px + labels
```

- Icons only by default (56px width)
- On hover, labels slide in from right
- Active item: left accent-primary border (3px) + bg-hover
- Clicking a nav item switches the chat list panel content

### 5.3 Keyboard Shortcuts

| Shortcut              | Action                          |
|-----------------------|---------------------------------|
| `Ctrl/Cmd + K`       | Quick search                    |
| `Ctrl/Cmd + N`       | New conversation                |
| `Ctrl/Cmd + ,`       | Open settings                   |
| `Ctrl/Cmd + /`       | Toggle sidebar                  |
| `Ctrl/Cmd + Shift + M` | Toggle mute                   |
| `Escape`             | Close modal / deselect          |
| `Up Arrow`           | Edit last message (when composer empty) |
| `Ctrl/Cmd + Enter`   | Send message                    |
| `Ctrl/Cmd + E`       | Toggle emoji picker             |

### 5.4 Window Dimensions

| Breakpoint      | Width      | Layout                          |
|-----------------|------------|---------------------------------|
| Small           | < 900px    | Mobile layout (bottom nav)      |
| Medium          | 900-1200px | Three-panel (chat list collapsible) |
| Large           | 1200-1600px| Three-panel (full)              |
| Extra Large     | > 1600px   | Three-panel + wider chat list   |

---

## 6. Mobile Layout

### 6.1 Screen Structure

```
+----------------------------------+
|  Status Bar (system)             |
+----------------------------------+
|  Navigation Header               |
|  (title + actions)               |
+----------------------------------+
|                                  |
|                                  |
|          Screen Content          |
|          (scrollable)            |
|                                  |
|                                  |
+----------------------------------+
|  Bottom Navigation               |
+----------------------------------+
|  Home Indicator (system)         |
+----------------------------------+
```

### 6.2 Bottom Navigation

```
+----------------------------------+
|  [chat]  [channel]  [mesh]  [+] |
+----------------------------------+
```

**Tab Configuration:**
| Tab      | Icon        | Badge        | Screen              |
|----------|-------------|--------------|---------------------|
| Chats    | chat-bubble | Total unread | ChatListScreen      |
| Channels | hash        | Channel count| ChannelBrowserScreen|
| Mesh     | network     | Peer count   | MeshScreen          |
| More     | ellipsis    | None         | Overflow menu       |

**Tab Behavior:**
- Tap: switch to tab, reset scroll to top
- Long press: haptic feedback + preview of screen
- Badge: red circle with number, max "99+"
- Active tab: accent-primary color fill + scale(1.05) animation
- Inactive tabs: text-secondary color, no fill

### 6.3 Mobile Navigation Stack

```
ChatsScreen
  -> ChatScreen (push)
    -> ChatInfoScreen (push)
      -> UserProfileScreen (push)
  -> SearchScreen (push)
  -> SettingsScreen (push)
    -> ProfileScreen (push)
    -> DeviceManagementScreen (push)
```

**Navigation Transitions:**
- Push: slide from right (300ms ease-out)
- Pop: slide to right (250ms ease-in)
- Modal: slide from bottom (300ms spring)
- Dismiss modal: slide to bottom (250ms ease-in)

### 6.4 Pull-to-Refresh

- Applied to all list screens
- Custom spinner with DipChats branding
- Trigger threshold: 80px pull distance
- Haptic feedback on trigger
- Bounce animation on release

### 6.5 Swipe Actions

| Screen       | Swipe Right       | Swipe Left         |
|--------------|-------------------|--------------------|
| Chat List    | Pin/Unpin         | Mute/Archive       |
| Message      | Reply             | React (default emoji) |
| File         | Share             | Delete             |

- Swipe threshold: 80px to trigger action
- Haptic feedback at trigger point
- Snap-back animation if not triggered
- Action revealed behind message with icon + label

---

## 7. User Flows

### 7.1 Onboarding Flow

```
[App Launch]
    |
    v
[Join Screen] -- enter display name --> [Generate Local Identity]
    |                                        |
    v                                        v
[Name Validation] <-- invalid               [Store Identity Locally]
    | (show error)                              |
    v                                           v
[Re-enter Name]                          [Navigate to Home]
```

**Steps:**
1. App launches, check for existing identity
2. If no identity: show Join Screen
3. User types display name (auto-focused)
4. Real-time validation: 1-32 chars, no special chars
5. "Join Now" button enables when valid
6. Tap: generate cryptographic identity (instant)
7. Store identity in local secure storage
8. Navigate to Home screen
9. First-time: show welcome tooltip explaining features

### 7.2 Send Message Flow

```
[Chat Screen] -- type message --> [Message Composer]
    |                                    |
    v                                    v
[Real-time Preview]              [Send Button Active]
    |                                    |
    |                          [Tap Send]
    |                                    |
    v                                    v
[Optimistic UI Update]         [Queue for Send]
    |                                    |
    |                                    v
    |                           [Network Available?]
    |                           /                \
    v                         Yes                 No
[Show Sent Status]              |                 |
    |                           v                 v
    v                    [Send via Relay]   [Queue Locally]
[Update Status: Sent]         |                 |
    |                         v                 v
    v                    [Delivered]     [Send on Reconnect]
[Update Status: Delivered]      |
    |                         v
    v                    [Read by Recipient]
[Update Status: Read]
```

### 7.3 Create Channel Flow

```
[Channel Browser] -- tap [+] --> [Create Channel Modal]
    |                                    |
    v                                    v
[Enter Channel Name]              [Configure Settings]
    | (real-time validation)         - Description
    v                               - Visibility
[Name Available?]                  - Ephemeral toggle
    |                                    |
    v                                    v
[Show Error] or                  [Tap "Create Channel"]
[Show Success]                          |
    |                                    v
    |                           [Channel Created]
    |                                    |
    |                                    v
    |                           [Navigate to Channel]
    |                                    |
    v                                    v
[Channel appears in              [Show Success Toast]
 channel list]
```

### 7.4 Join Mesh Flow

```
[Mesh Screen] -- shows discovered nodes
    |
    v
[Scan for Peers] -- automatic background process
    |
    v
[Peer Discovered] -- shows signal strength
    |
    v
[User Taps "Connect"]
    |
    v
[Initiate Connection]
    |
    v
[Connection Established]
    |
    v
[Peer moves to "Connected" list]
    |
    v
[Messages can now route through peer]
```

### 7.5 Share File Flow

```
[Chat Composer] -- tap [+] --> [Attach Menu]
    |                                    |
    v                                    v
[Select Source]                 [Bottom Sheet]
- Camera                        - Photo
- Gallery                       - File
- Document                      - Camera
- Location                      - Location
    |                                    |
    v                                    v
[File Selected]                  [Preview]
    |                                    |
    v                                    v
[File Info Displayed]           [Tap Send]
- Filename                       |
- Size                          v
- Type                    [Upload Progress]
- Preview (if image)            |
    |                          v
    v                    [File Attached to Message]
[Send with Message]
    |
    v
[File Shared in Chat]
    |
    v
[Other Users Can Download]
```

### 7.6 Ephemeral Message Flow

```
[Toggle Ephemeral Mode] -- in composer or chat settings
    |
    v
[Ephemeral Icon Visible] -- clock icon next to composer
    |
    v
[Send Ephemeral Message]
    |
    v
[Message Delivered] -- normal delivery
    |
    v
[Timer Starts] -- from delivery time
    |
    v
[Timer Running] -- shows countdown on hover/long-press
    |
    v
[Timer Expires]
    |
    v
[Message Deleted from All Devices]
    |
    v
[Replacement Text: "This message has expired"]
```

### 7.7 Device Pairing Flow

```
[Settings > Devices > Add New Device]
    |
    v
[QR Code Displayed] -- on existing device
    |
    v
[New Device Scans QR] -- or enters pairing code
    |
    v
[Identity Sync] -- transfer local identity
    |
    v
[Device Added to List]
    |
    v
[Mesh Connection Established] -- if nearby
    |
    v
[Sync Messages and Files] -- background sync
```

---

## 8. Component Specifications

### 8.1 Buttons

**Primary Button:**
```
+----------------------------------+
|           Primary Action         |
+----------------------------------+

Height: 40px
Padding: 0 24px
Background: accent-primary
Text: text-inverse, body-medium (14px/600)
Border-radius: radius-md (8px)
Hover: brightness(1.1)
Active: brightness(0.9) + scale(0.98)
Disabled: opacity(0.5), cursor: not-allowed
Focus: shadow-glow
```

**Secondary Button:**
```
+----------------------------------+
|          Secondary Action        |
+----------------------------------+

Height: 40px
Padding: 0 24px
Background: transparent
Border: 1px solid border-default
Text: text-primary, body-medium (14px/600)
Border-radius: radius-md (8px)
Hover: bg-hover
Active: bg-active
```

**Danger Button:**
```
+----------------------------------+
|         Destructive Action       |
+----------------------------------+

Height: 40px
Padding: 0 24px
Background: accent-danger
Text: text-inverse, body-medium (14px/600)
Border-radius: radius-md (8px)
Hover: brightness(1.1)
Active: brightness(0.9)
```

**Icon Button:**
```
+------+
|  [I] |
+------+

Height: 32px (compact) / 40px (standard)
Width: 32px / 40px
Background: transparent
Icon: 18px, text-secondary
Border-radius: radius-md (8px)
Hover: bg-hover, text-primary
Active: bg-active
```

**Ghost Button:**
```
|  Click Here  |

Height: 32px
Padding: 0 12px
Background: transparent
Text: accent-primary, body-medium (14px/500)
Hover: bg-hover
Border-radius: radius-sm (4px)
```

### 8.2 Text Input

**Standard Input:**
```
+--------------------------------------------+
|  Label (optional)                          |
|  +--------------------------------------+  |
|  |  Placeholder text...                  |  |
|  +--------------------------------------+  |
|  |  Helper text (optional)               |  |
|  +--------------------------------------+  |
+--------------------------------------------+

Height: 40px
Padding: 0 12px
Background: bg-input
Border: 1px solid border-default
Border-radius: radius-md (8px)
Text: input (15px/400)
Placeholder: text-tertiary
Focus: border-focus + shadow-glow
Error: border-accent-danger + error text
```

**Search Input:**
```
+--------------------------------------------+
|  [magnifying-glass]  Search...        [X]  |
+--------------------------------------------+

Height: 36px
Padding: 0 12px
Background: bg-tertiary
Border: none
Border-radius: radius-full (9999px)
Text: input (15px/400)
Placeholder: text-tertiary
Focus: border-focus + shadow-glow
```

### 8.3 Message Bubble

**Own Message (Right-aligned):**
```
                +------------------------+
                |  Message text goes     |
                |  here.                 |
                |                   10:36 |
                +------------------------+

Background: bg-message-own
Text: text-primary, message-text (14px/400)
Border-radius: 16px 16px 4px 16px (top-left rounded, bottom-left squared)
Padding: 8px 12px
Max-width: 70% of chat area
Shadow: none (or shadow-sm for depth)
```

**Other Message (Left-aligned):**
```
+------------------------+
|  Message text goes     |
|  here.                 |
|  10:36                 |
+------------------------+

Background: bg-message-other
Text: text-primary, message-text (14px/400)
Border-radius: 16px 16px 16px 4px (top-right rounded, bottom-right squared)
Padding: 8px 12px
Max-width: 70% of chat area
```

**Message with Reply:**
```
+------------------------+
| > Quoted message       |
|   preview text...      |
+------------------------+
|  Reply text goes here. |
|  10:36                 |
+------------------------+

Reply section:
- Background: slightly lighter than bubble
- Border-left: 2px solid accent-primary
- Padding: 4px 8px
- Text: caption (12px), text-secondary
```

### 8.4 Avatar

```
+--------+
|        |
|  AVA   |
|        |
+--------+

Sizes:
- xs: 24px (inline, reactions)
- sm: 32px (chat list, mentions)
- md: 40px (chat header, settings)
- lg: 48px (member list)
- xl: 64px (profile, onboarding)

Border-radius: radius-2xl (24px) - always circular
Border: 2px solid bg-primary (for overlapping avatars)
Status indicator: 8px circle at bottom-right
  - Online: accent-success
  - Away: accent-warning
  - Offline: text-tertiary
  - DND: accent-danger
```

### 8.5 Toggle Switch

```
OFF:                        ON:
+-----------+               +-----------+
|  [----O]  |               |  [O----]  |
+-----------+               +-----------+

Width: 44px
Height: 24px
Border-radius: radius-full (12px)
Track OFF: bg-tertiary
Track ON: accent-primary
Thumb: 20px circle, white, shadow-sm
Transition: 200ms ease
```

### 8.6 Badge

```
Count Badge:   [3]
Max Badge:     [99+]
Dot Badge:     (small red dot)

Height: 18px (count) / 8px (dot)
Min-width: 18px (count)
Padding: 0 5px (count)
Background: accent-danger
Text: text-inverse, small (11px/600)
Border-radius: radius-full (9px)
Position: top-right of parent, offset (-4px, -4px)
```

### 8.7 Dropdown / Select

```
+-------------------+
|  Selected Option  | v
+-------------------+
|  Option 1         |
|  Option 2         |
|  Option 3         |
|  Option 4         |
+-------------------+

Width: matches trigger element
Background: bg-modal
Border: 1px solid border-default
Border-radius: radius-md (8px)
Shadow: shadow-lg
Padding: 4px 0
Item height: 36px
Item padding: 0 12px
Item hover: bg-hover
Item active: bg-active
Selected: checkmark icon + accent-primary text
```

### 8.8 Tooltip

```
+-------------------+
|  Tooltip text     |
+-------------------+
        |
        v
  [trigger element]

Background: bg-tertiary
Text: text-primary, caption (12px)
Border-radius: radius-sm (4px)
Padding: 4px 8px
Shadow: shadow-md
Position: above trigger, centered
Arrow: 6px triangle pointing down
Delay: 300ms before showing
```

### 8.9 Context Menu

```
+-------------------------------+
|  Reply                        |  height: 36px
|  React                        |  padding: 0 12px
|  Copy Text                    |  hover: bg-hover
|  Forward...                   |  icon: 16px left
|  Pin Message                  |  text: body (14px)
|  Delete Message               |  divider before Delete
|  Report                       |  Delete: accent-danger
+-------------------------------+

Width: 200px
Background: bg-modal
Border: 1px solid border-default
Border-radius: radius-md (8px)
Shadow: shadow-xl
Padding: 4px 0
Item height: 36px
Separator: 1px solid border-subtle, margin: 4px 0
```

### 8.10 Toast Notification

```
+------------------------------------------+
|  [icon]  Notification text          [X]  |
+------------------------------------------+

Position: bottom-right (desktop) / top (mobile)
Width: max 400px, min 300px
Height: auto
Padding: 12px 16px
Background: bg-toast
Border: 1px solid border-default
Border-radius: radius-md (8px)
Shadow: shadow-lg
Icon: 20px, left side
Text: body (14px), flex: 1
Close button: 16px, right side
Animation: slide in from right (desktop), slide from top (mobile)
Duration: auto-dismiss after 5 seconds (success/info), persistent (error)
```

### 8.11 Modal

```
+-----------------------------------------------------------+
|                                                           |
|  Backdrop: overlay-backdrop                               |
|                                                           |
|     +-----------------------------------------------+     |
|     |  Modal Title                           [X]   |     |
|     |  ------------------------------------------  |     |
|     |                                               |     |
|     |  Modal body content.                          |     |
|     |  Can contain forms, text, or anything.        |     |
|     |                                               |     |
|     |                                               |     |
|     +-----------------------------------------------+     |
|     |                                               |     |
|     |  [Cancel]                    [Confirm]        |     |
|     |                                               |     |
|     +-----------------------------------------------+     |
|                                                           |
+-----------------------------------------------------------+

Width: max 480px, min 320px
Background: bg-modal
Border-radius: radius-lg (12px)
Shadow: shadow-xl
Padding: 0
Header: heading-3, padding: 20px 24px, border-bottom
Body: padding: 20px 24px
Footer: padding: 16px 24px, border-top, flex end
Close button: top-right, 32px
Animation: fade in + scale from 0.95 (200ms ease)
```

### 8.12 Spinner / Loading

```
Circular Spinner:
    +----+
    | /  |
    |   |
    +----+

Size: 20px (inline) / 32px (screen) / 48px (full page)
Color: accent-primary
Animation: rotate 800ms linear infinite
Stroke: 2px, rounded caps

Skeleton Loader:
+--------------------------------------------+
|  [shimmer animation]                       |
+--------------------------------------------+

Background: bg-tertiary
Animation: shimmer (gradient slide, 1.5s infinite)
Border-radius: radius-sm (4px)
```

### 8.13 Empty State

```
+-----------------------------------------------------------+
|                                                           |
|                    (illustration)                         |
|                                                           |
|              No messages yet                              |
|                                                           |
|     Start a conversation by sending a message            |
|     to this channel or direct message.                   |
|                                                           |
|              [Action Button]                              |
|                                                           |
+-----------------------------------------------------------+

Illustration: custom SVG, 120px height
Title: heading-3, text-primary
Description: body, text-secondary, max-width 400px
Action: primary button
Padding: 48px 24px
```

### 8.14 Divider

```
Horizontal:
+-----------------------------------------------------------+
|  -------------------------------------------------------  |
+-----------------------------------------------------------+

Height: 1px
Background: border-subtle
Margin: 8px 0 (compact) / 16px 0 (standard)

Vertical:
|
|  (1px wide)
|

Width: 1px
Background: border-subtle
Margin: 0 8px (compact) / 0 16px (standard)
```

---

## 9. Notification Design

### 9.1 Notification Types

| Type         | Trigger                        | Behavior                    |
|--------------|--------------------------------|-----------------------------|
| Message      | New message in active chat     | Sound + badge + preview     |
| Mention      | @mention in channel            | Sound + badge + highlight   |
| DM           | New direct message             | Sound + badge + preview     |
| Channel      | New channel message (not muted)| Badge only                  |
| Mesh         | Peer connected/disconnected    | Info toast                  |
| System       | App updates, errors            | Toast                       |

### 9.2 Desktop Notifications

**Notification Banner:**
```
+------------------------------------------+
|  [avatar]  Alice in #general            |
|            Hey, are you available?       |
|                          10:36 AM        |
+------------------------------------------+
```

- Position: top-right (macOS) / bottom-right (Windows/Linux)
- Duration: 5 seconds (click to open, hover to pause)
- Click: navigate to chat, focus app
- Dismiss: swipe right or click X
- Sound: configurable per notification type
- Preview: first 100 characters of message

### 9.3 Mobile Notifications

**Push Notification:**
```
+------------------------------------------+
|  DipChats                               |
|  Alice: Hey, are you available?          |
|                          10:36 AM        |
+------------------------------------------+
```

- Position: system notification area
- Grouped by conversation
- Tap: open app to specific chat
- Long press: quick reply (iOS/Android)
- Badge: total unread count on app icon
- Sound: configurable

### 9.4 In-App Notification Indicators

- Unread badge on chat list items
- Badge count on navigation tabs
- "New messages" bar in chat when scrolled up
- Typing indicator above composer
- Connection status bar (offline/warning)
- Toast notifications for actions (sent, failed, etc.)

---

## 10. Empty States and Error States

### 10.1 Empty States

**No Conversations:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (chat bubble icon)                     |
|                                                           |
|              No conversations yet                         |
|                                                           |
|     Start chatting by creating a channel or              |
|     sending a direct message.                            |
|                                                           |
|        [Create Channel]    [Start DM]                    |
|                                                           |
+-----------------------------------------------------------+
```

**No Search Results:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (magnifying glass icon)                |
|                                                           |
|              No results found                             |
|                                                           |
|     Try a different search term or check your filters.   |
|                                                           |
+-----------------------------------------------------------+
```

**No Files:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (folder icon)                          |
|                                                           |
|              No files shared yet                          |
|                                                           |
|     Files shared in chats will appear here.              |
|                                                           |
+-----------------------------------------------------------+
```

**No Mesh Peers:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (network icon)                         |
|                                                           |
|              No peers found                               |
|                                                           |
|     Make sure other DipChats users are nearby             |
|     and have mesh networking enabled.                    |
|                                                           |
|              [Scan Again]                                 |
|                                                           |
+-----------------------------------------------------------+
```

### 10.2 Error States

**Network Error:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (wifi-off icon)                        |
|                                                           |
|              Connection lost                              |
|                                                           |
|     Messages will be sent when connection is restored.   |
|     Check your network settings.                         |
|                                                           |
|              [Retry]     [Settings]                      |
|                                                           |
+-----------------------------------------------------------+
```

**Send Failed:**
```
+------------------------+
|  [!] Failed to send    |
|  [retry] [delete]      |
+------------------------+
```

- Appears inline below the failed message
- Red border accent
- Tap retry: re-attempt send
- Tap delete: remove message

**Channel Not Found:**
```
+-----------------------------------------------------------+
|                                                           |
|                    (hash icon, broken)                    |
|                                                           |
|              Channel not found                            |
|                                                           |
|     This channel may have been deleted or you            |
|     may not have access.                                 |
|                                                           |
|              [Go Back]                                   |
|                                                           |
+-----------------------------------------------------------+
```

**File Upload Failed:**
```
+-----------------------------------------------------------+
|  [!] upload-failed.png                                    |
|  File could not be uploaded. Tap to retry.               |
|  [retry] [cancel]                                        |
+-----------------------------------------------------------+
```

---

## 11. Accessibility

### 11.1 Keyboard Navigation

- All interactive elements must be focusable
- Tab order follows visual layout (left-to-right, top-to-bottom)
- Focus ring: 2px solid border-focus with shadow-glow
- Skip navigation: "Skip to main content" link
- Arrow keys for list navigation
- Enter/Space for activation
- Escape to close modals and menus
- Focus trap in modals (cycle through focusable elements)

### 11.2 Screen Reader Support

- All images and icons have alt text or aria-label
- Form inputs have associated labels
- ARIA roles for custom components:
  - Chat list: role="list" with role="listitem"
  - Message composer: role="textbox" with aria-multiline
  - Navigation: role="navigation" with aria-label
  - Modal: role="dialog" with aria-modal
  - Toast: role="status" with aria-live="polite"
- Live regions for dynamic content (typing indicators, toasts)
- Semantic HTML: nav, main, article, section, aside

### 11.3 Color and Contrast

- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text and icons
- Never use color alone to convey information
- Status indicators use both color and icon/shape
- Focus indicators visible in both light and dark modes

### 11.4 Touch Targets

- Minimum touch target: 44x44px (WCAG 2.5.5)
- Button minimum height: 40px
- List item minimum height: 48px
- Spacing between touch targets: minimum 8px

### 11.5 Motion and Animation

- Respect prefers-reduced-motion system setting
- Disable all non-essential animations when reduced motion enabled
- Essential animations (page transitions) use reduced duration
- No auto-playing animations that loop indefinitely
- Pause/stop controls for any moving content

### 11.6 Text and Readability

- Minimum font size: 12px
- Line height: minimum 1.4x font size
- Maximum line length: 80 characters
- Text can be resized up to 200% without loss of functionality
- No text in images (except logos)

### 11.7 Focus Management

- Focus moves logically through the interface
- New content does not steal focus unexpectedly
- Return focus to trigger element when modal closes
- Focus ring visible on all interactive elements
- High contrast mode support

---

## 12. Responsive Design

### 12.1 Breakpoint System

| Breakpoint      | Width          | Layout Changes                      |
|-----------------|----------------|-------------------------------------|
| Mobile S        | < 375px        | Minimum supported, compact spacing  |
| Mobile M        | 375-428px      | Standard mobile layout              |
| Mobile L        | 429-768px      | Larger mobile / small tablet        |
| Tablet          | 769-1024px     | Side panel option, larger elements  |
| Desktop S       | 1025-1200px    | Three-panel, collapsible chat list  |
| Desktop M       | 1201-1440px    | Three-panel, full chat list         |
| Desktop L       | 1441-1920px    | Three-panel, expanded spacing       |
| Desktop XL      | > 1920px       | Max-width container, centered       |

### 12.2 Fluid Typography

```
Font sizes scale between breakpoints:

Mobile:     12px (caption) - 16px (body)
Tablet:     13px (caption) - 15px (body)
Desktop:    14px (body standard)

Heading-1:  24px (mobile) -> 28px (desktop)
Heading-2:  18px (mobile) -> 22px (desktop)
```

### 12.3 Layout Adaptations

**Mobile (< 768px):**
- Single column, full width
- Bottom navigation
- Chat list as main screen
- Swipe gestures for navigation
- Bottom sheets for actions
- Full-screen modals

**Tablet (769-1024px):**
- Optional split view
- Side panel for chat list
- Larger touch targets
- More content visible

**Desktop (> 1024px):**
- Three-panel layout
- Sidebar with labels
- Keyboard shortcuts
- Hover states
- Context menus
- Floating panels

### 12.4 Content Reflow

- Content reflows at each breakpoint (no horizontal scrolling)
- Max content width: 720px for messages, 480px for forms
- Side padding: 16px (mobile) -> 24px (tablet) -> 32px (desktop)
- Chat list width: 100% (mobile) -> 280-400px (desktop)

---

## 13. Animation and Transitions

### 13.1 Timing Functions

| Token         | Value                      | Use Case                |
|---------------|----------------------------|-------------------------|
| `ease`       | cubic-bezier(0.25, 0.1, 0.25, 1) | General transitions |
| `ease-in`    | cubic-bezier(0.42, 0, 1, 1)      | Exit animations    |
| `ease-out`   | cubic-bezier(0, 0, 0.58, 1)      | Enter animations   |
| `ease-in-out`| cubic-bezier(0.42, 0, 0.58, 1)   | Size changes       |
| `spring`     | cubic-bezier(0.34, 1.56, 0.64, 1)| Bouncy entrances   |

### 13.2 Duration Scale

| Token       | Duration | Use Case                          |
|-------------|----------|-----------------------------------|
| `instant`  | 100ms    | Hover states, micro-interactions  |
| `fast`     | 200ms    | Button presses, toggles           |
| `normal`   | 300ms    | Panel transitions, modals         |
| `slow`     | 500ms    | Page transitions                  |
| `slower`   | 700ms    | Complex choreographed animations  |

### 13.3 Transition Specifications

**Page Transitions:**
```
Enter:  opacity 0 -> 1 (200ms ease-out)
        transform translateX(20px) -> 0 (300ms ease-out)

Exit:   opacity 1 -> 0 (150ms ease-in)
        transform translateX(0) -> translateX(-20px) (200ms ease-in)
```

**Modal Transitions:**
```
Open:   backdrop opacity 0 -> 1 (200ms ease)
        content opacity 0 -> 1 + scale(0.95 -> 1) (300ms spring)

Close:  backdrop opacity 1 -> 0 (150ms ease)
        content opacity 1 -> 0 + scale(1 -> 0.95) (200ms ease)
```

**Bottom Sheet (Mobile):**
```
Open:   transform translateY(100%) -> 0 (300ms spring)
        backdrop opacity 0 -> 1 (200ms ease)

Close:  transform translateY(0) -> translateY(100%) (250ms ease-in)
        backdrop opacity 1 -> 0 (200ms ease)

Drag:   follows finger with rubber-band at edges
        release: snap to open or close based on velocity/position
```

**Message Send:**
```
1. Message appears in composer (opacity 0 -> 1, 100ms)
2. Message slides up into chat (translateY(10px) -> 0, 200ms ease-out)
3. Send button pulses (scale 1 -> 1.2 -> 1, 300ms spring)
4. Status icon appears (opacity 0 -> 1, 150ms)
```

**Typing Indicator:**
```
Three dots, each animating:
  - scale: 0.5 -> 1 -> 0.5
  - opacity: 0.3 -> 1 -> 0.3
  - duration: 600ms per dot
  - delay: 150ms between dots (staggered)
```

**Unread Badge:**
```
Enter:  scale 0 -> 1.2 -> 1 (300ms spring)
        opacity 0 -> 1 (200ms ease)
```

**Toast Notification:**
```
Enter:  translateX(100%) -> 0 (300ms spring)
        opacity 0 -> 1 (200ms ease)

Exit:   translateX(0) -> translateX(100%) (200ms ease-in)
        opacity 1 -> 0 (150ms ease)
```

**Skeleton Shimmer:**
```
Background gradient animating:
  - gradient position: -200% -> 200%
  - duration: 1.5s
  - timing: linear, infinite
  - effect: subtle shimmer across placeholder content
```

**Navigation Tab:**
```
Active:   icon scale 1 -> 1.05 (200ms spring)
          color text-secondary -> accent-primary (200ms ease)
          indicator bar width 0 -> 100% (300ms spring)

Inactive: icon scale 1.05 -> 1 (150ms ease)
          color accent-primary -> text-secondary (150ms ease)
          indicator bar width 100% -> 0 (200ms ease)
```

**Swipe Action:**
```
Follow finger:     translateX follows delta with rubber-band at threshold
Snap to trigger:   translateX -> action width (200ms spring)
Snap back:         translateX -> 0 (250ms ease)
Trigger action:    opacity 0 + translateX -> action width + (200ms ease-in)
```

### 13.4 Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- All transitions duration set to 0ms (instant)
- All animations disabled except:
  - Focus ring visibility (essential for accessibility)
  - Loading spinners (essential for feedback)
- Page transitions: simple opacity fade (200ms)
- No spring/elastic easing (use linear or ease)
- Skeleton shimmer disabled (show static placeholder)
- Typing indicator: static dots (no animation)

---

## Appendix A: Platform-Specific Notes

### A.1 Web (React + Vite + Tailwind)

- CSS custom properties for design tokens
- Tailwind config extends default theme with tokens
- Component library: Radix UI primitives + custom styling
- State management: Zustand or React Context
- Routing: React Router v6+
- Responsive: Tailwind responsive prefixes (sm, md, lg, xl)

### A.2 Desktop (Tauri)

- Native window chrome or custom titlebar
- System tray integration for notifications
- Global keyboard shortcuts
- File system access for local storage
- Auto-updater integration
- Window state persistence (size, position)
- Dock/taskbar badge for unread count

### A.3 Mobile (React Native)

- Bottom sheet: @gorhom/bottom-sheet
- Navigation: React Navigation (native stack)
- Haptics: expo-haptics or react-native-haptics
- Push notifications: expo-notifications
- Biometrics: expo-local-authentication
- Safe area: react-native-safe-area-context
- Gesture handler: react-native-gesture-handler

---

## Appendix B: Design File References

- Figma: [Link to Figma project]
- Storybook: [Link to component library]
- Icon Set: Lucide React (consistent with design language)
- Font: Inter (Google Fonts, self-hosted)
- Emoji Set: System native + custom reactions
