// Common helpers for quasar.conf.js

function qenvLoad(ctx, rootDir, env, opts) {
    const envv = {
        ...qenvDotEnvParse(ctx, rootDir, env, opts),
        ...qenvBuildInfo(ctx, rootDir, env, opts),
    };

    if (!opts || !opts.noLog) {
        console.log('QENV', JSON.stringify(envv, null, 2));
    }

    return {
        envv,
    };
}

function qenvDotEnvParse(ctx, rootDir, env, opts) {
    const DotEnv = require('dotenv');
    const Path = require('path');
    const fs = require('fs');

    let envId = env.QENV;

    if (!envId && ctx.dev) {
        envId = 'local';
    }

    if (!envId) {
        throw new Error('environment variable QENV is required');
    }

    const envPath = Path.join(rootDir, `.env.${envId}`);
    if (!fs.existsSync(envPath)) {
        throw new Error('env file not found: ' + envPath);
    }

    const envv = {
        ...DotEnv.parse(fs.readFileSync(envPath)),
        QENV: envId,
    };

    const o = {};
    Object.keys(envv).sort().forEach(key => o[key] = envv[key]);
    return o;
}

function qenvBuildInfo(ctx, rootDir, env, opts) {
    let buildAt = env.COMMIT_DATE
    let buildCommit = env.COMMIT_SHA;
    let buildIsDocker = env.DOCKER_BUILD === 'yes';
    opts = opts || {};

    if (!buildCommit && !opts.noGit) {
        buildCommit = execCommand('git rev-parse HEAD', rootDir, opts);
    }

    if (!buildAt && !opts.noGit) {
        buildAt = execCommand('git show -s --format=%ci', rootDir, opts);
    }

    if (buildIsDocker && (!buildAt || !buildCommit)) {
        throw new Error('COMMIT_DATE and COMMIT_SHA is required when DOCKER_BUILD=yes');
    }

    buildAt = new Date(buildAt || Date.now()).toISOString();
    buildCommit = buildCommit || 'unknown';

    return {
        COMMIT_DATE: buildAt,
        COMMIT_SHA: buildCommit,
        SHORT_SHA: buildCommit.substr(0, 7),
        DOCKER_BUILD: buildIsDocker ? 'yes' : '',
        BUILD_INFO: buildCommit.substr(0, 7) + ' ' + buildAt.substr(0, 16).replace('T', ' '),
    }
}

function execCommand(cmd, rootDir, opts) {
    if (!opts || !opts.noLog) {
        console.log('execCommand', JSON.stringify({ cmd, rootDir }));
    }
    return require('child_process').execSync(cmd, { cwd: rootDir }).toString().trim();
}

exports.qenvLoad = qenvLoad;
exports.qenvDotEnvParse = qenvDotEnvParse;
exports.qenvBuildInfo = qenvBuildInfo;
