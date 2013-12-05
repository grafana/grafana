String.prototype.graphiteGlob = function(glob) {
    var regex = '^';
    for (var i = 0; i < glob.length; i++ ) {
        var c = glob.charAt(i);
        switch (c) {
            case '*':
                regex += '[^\.]+';
                break;
            case '.':
                regex += '\\.';
                break;
            default:
                regex += c;
        }
    }
    regex += '$';
    return this.match(regex);
}
/*
if (!"stats.dfs4.timer".graphiteGlob('stats.*.timer')) {
    console.log('fail 1');
}
if ("stats.dfs4.timer".graphiteGlob('statsd.*.timer')) {
    console.log('fail 2');
}
if ("stats.dfs4.foo.timer".graphiteGlob('stats.*.timer')) {
    console.log('fail 3');
}
*/
