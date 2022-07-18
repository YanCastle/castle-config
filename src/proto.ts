import { join, resolve } from 'path';
import * as p from 'protobufjs'
import { exists } from 'mz/fs';
p.wrappers[".google.protobuf.Timestamp"] = {
    fromObject: function (object: any) {
        //Convert ISO-8601 to epoch millis
        try {
            var dt = Date.parse(object);
            return this.create({
                seconds: Math.floor(dt / 1000),
                nanos: dt % 1000
            })
        } catch (error) {
            return this.create({
                seconds: 0,
                nanos: 0
            })
        }
    },
    toObject: function (message: any, options) {
        // console.log(message)
        return new Date((message.seconds || 0) * 1000 + (message.nanos || 0));
    }
};
export namespace ProtoUtils {

    const loaded: { [index: string]: p.Root } = {};

    export async function load_proto(module_name: string, controller: string, method: string): Promise<p.Type> {
        let file = resolve(join('./proto', module_name));
        try {
            if (!loaded[file]) {
                if (await exists(file + '.js')) {
                    loaded[file] = require(file + '.js');
                }
                else {
                    loaded[file] = await p.load(file + '.proto');
                };
            }
            return loaded[file].lookupType([module_name, [controller, method].join('_')].join('.'))
        } catch (error) {

        }
        return loaded[file].lookupType([module_name, [controller, method].join('_')].join('.'))
    }

    export function base() {

    }
}