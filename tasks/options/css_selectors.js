module.exports = function (config) {
    return {
        options: {
            mutations: [
                {prefix: '#grafana'}
            ]
        },
        all: {
            files : {
                '<%= srcDir %>/css/grafana.dark.min.css': ['<%= srcDir %>/css/grafana.dark.min.css'],
                '<%= srcDir %>/css/grafana.light.min.css': ['<%= srcDir %>/css/grafana.light.min.css']
            }
        },

    };
};