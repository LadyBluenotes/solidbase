# SolidStart

Everything you need to build a Solid project, powered by [`solid-start`](https://start.solidjs.com);

## Creating a project

```bash
# create a new project in the current directory
npm init solid@latest

# create a new project in my-app
npm init solid@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Versioning smoke test

This dev app is wired with a sample version config so you can manually test
versioned docs routing.

Try these routes while the dev server is running:

- `/about` for latest docs
- `/fr/about` for latest docs with locale
- `/v1.1.16/about` for versioned docs
- `/v1.1.16/es/about` for versioned docs with locale

Sample frozen docs live in `dev/versioned_docs/v1.1.16/`.

## Building

Solid apps are built with _presets_, which optimise your project for deployment to different environments.

By default, `npm run build` will generate a Node app that you can run with `npm start`. To use a different preset, add it to the `devDependencies` in `package.json` and specify in your `app.config.js`.

## This project was created with the [Solid CLI](https://solid-cli.netlify.app)
