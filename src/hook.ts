/**
 * 初始化钩子
 */
const Hooks: {
    [index: string]: {
        Async: { [index: string]: Function },
        Sync: { [index: string]: Function }
    }
} = {};
class Hook {
    /**
     * 注册Hook事件
     * @param Where 
     * @param HookID 
     * @param Callback 
     * @param Async 
     */
    regist(Where: string, HookID: string, Callback: Function, Async: boolean = true) {
        if (!Hooks[Where]) {
            Hooks[Where] = {
                Async: {},
                Sync: {}
            };
        }
        // if (hooks[Where][HookID]) {
        if (Callback instanceof Function) {
            if (Async) {
                Hooks[Where].Async[HookID] = Callback;
            } else {
                Hooks[Where].Sync[HookID] = Callback;
            }
        }
        return true;
    }
    /**
     * 反注册Hook事件
     * @param Where 
     * @param HookID 
     */
    unregist(Where: string, HookID: string) {
        if (!Hooks[Where]) {
            return true;
        }
        if (Hooks[Where].Async[HookID]) {
            delete Hooks[Where].Async[HookID]
        }
        if (Hooks[Where].Sync[HookID]) {
            delete Hooks[Where].Sync[HookID]
        }
        return true;
    }
    /**
     * 触发Hook事件
     * @param Where 
     * @param Data 
     */
    async emit(Where: string, Ctx: any, Data: any) {
        if (!Hooks[Where]) {
            return true;
        }
        let hooks = Object.keys(Hooks[Where].Async);
        let asyncs = [];
        for (let i = 0; i < hooks.length; i++) {
            asyncs.push(Hooks[Where].Async[hooks[i]](Ctx, Data))
        }
        let syncHooks = Object.keys(Hooks[Where].Sync);
        for (let i = 0; i < hooks.length; i++) {
            await Hooks[Where].Sync[syncHooks[i]](Ctx, Data)
        }
        return true;
    }
}
const hook = new Hook()
export default hook;