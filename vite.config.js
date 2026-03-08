import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
function resolveBasePath() {
    var _a;
    var repository = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/')[1];
    if (!repository || repository.toLowerCase().endsWith('.github.io')) {
        return '/';
    }
    return "/".concat(repository, "/");
}
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        plugins: [react()],
        base: command === 'build' ? resolveBasePath() : '/',
        server: {
            watch: {
                usePolling: true,
            },
        },
    });
});
