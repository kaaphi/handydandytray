# HandyDandyTray

HandyDandyTray is a system tray service with utilities that I find useful for my day-to-day as a software engineer.

## Getting Started

1. Navigate to your project directory in the terminal.

2. To run the application in development mode, use the following command:

   ```
   wails3 dev
   ```

   This will start your application and enable hot-reloading for both frontend and backend changes.

3. To build the application for production, use:

   ```
   wails3 build
   ```

   This will create a production-ready executable in the `build` directory.

## Project Structure

- `frontend/`: Contains your frontend code (HTML, CSS, JavaScript/TypeScript)
- `main.go`: The entry point of the Go backend

## Creating a release

Make sure you are on `main` and are up-to-date. Run the `release:tag` task to create a tag for the next semantic version and push the tag to origin:

```
wails3 task release:tag
```

When the tag is pushed up, the Release Application workflow will automatically run to create a release.
