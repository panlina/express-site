# express-site [![test](https://github.com/panlina/express-site/actions/workflows/test.yml/badge.svg)](https://github.com/panlina/express-site/actions/workflows/test.yml)
A host for node/express web applications, with a RESTful admin API.

Quickly turn your server into a website/gateway. Easily add/remove apps. Good for personal site.

Support:
- proxy based on domain or path

# Installation

    npm install -g express-site

# Usage

    express-site [options] <dir>

This will start the site at port 80, and the admin API at port 9000, both over http by default. These can be changed by options.

Enter `express-site --help` to view all options.

# Configuration

You can put configuration files in the site directory. You need to restart the site after modifying them.

## `cors.json`

CORS configuration. See https://github.com/expressjs/cors#configuration-options.

## `proxyOptions.json`

Proxy options. See https://github.com/http-party/node-http-proxy#options.

## `adminBasicAuth.json`

Admin API basic auth configuration. See https://github.com/LionC/express-basic-auth#readme.
