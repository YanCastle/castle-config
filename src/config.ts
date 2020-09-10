import { env } from 'process'
import { MD5 } from '@ctsy/crypto'
import * as Sequelize from 'sequelize'
import { resolve, join, extname } from 'path';
import { Context } from 'koa';
import { uuid } from '@ctsy/common';
import * as send from 'koa-send'
import hook, { HookWhen } from '@ctsy/hook'
const SequelizeDBs: { [index: string]: Sequelize.Sequelize } = {

}
/**
 * 默认配置文件信息
 */
export default class DefaultConfig {
    protected _ctx: Context;
    sendFile: boolean = false;
    constructor(ctx: any,) {
        this._ctx = ctx;
    }
    /**
     * get App Debug Status
     */
    getAppDebug(): boolean {
        return env.NODE_ENV == 'production';
    }
    /**
     * get Static Path ,
     */
    getStaticPath(): string {
        return 'Public';
    }
    /**
     * 获取应用地址
     */
    getAppPath(): string {
        return 'dist';
    }
    /**
     * 获取Lib目录
     */
    getLibPath(more: boolean = false) {
        if (false === more)
            return this._ctx.route && this._ctx.route.Path ? this._ctx.route.Path : this.getAppPath()
        else {
            let lib = [this.getAppPath()]
            if (this._ctx.route) {
                if (this._ctx.route.Paths)
                    lib.unshift(...this._ctx.route.Paths)
                else {
                    lib.unshift(this._ctx.route.Path);
                }
            }
            return lib;
        }
    }
    /**
     * 获取新的SessionID
     */
    async getNewSessionID() {
        let value = uuid('session');
        try {
            this._ctx.set('Token', value);
            this._ctx.set('Access-Control-Expose-Headers', 'Token')
        }
        catch (error) {
        }
        return value;
    }
    /**
     * 获取SessionID
     */
    async getSessionID() {
        return this._ctx.get('Token') || this._ctx.cookies.get('Token');
    }
    protected _sessionConfig = {
        Driver: 'default',
        Config: {
            key: 'castlekoa',
            path: '.sess',
            maxAge: 86400000,
            overwrite: true, /** (boolean) can overwrite or not (default true) */
            httpOnly: true, /** (boolean) httpOnly or not (default true) */
            signed: true, /** (boolean) signed or not (default true) */
            rolling: false, /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */
            renew: false, /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/
        }
    };
    /**
     * 获取session配置信息
     */
    async getSessionConfig(): Promise<{
        Driver: any,
        Config: any
    }> {
        return this._sessionConfig;
    }
    /**
     * 获取数据库配置
     */
    async getDbConfig(): Promise<{ database: string, username: string, password: string, options?: any }> {
        return {
            database: env.DB_NAME || 'test',
            username: env.DB_USER || 'root',
            password: env.DB_PWD || '123456',
            options: {
                host: env.DB_HOST || 'localhost',
                port: env.DB_PORT || 3306,
                dialect: env.DB_DIALET || 'mysql',
                timezone: env.DB_TIMEZONE || '+8:00',
                benchmark: true,
                pool: { max: 5, min: 1, acquire: 300000, idle: 1000 },
                logging: (await this.getAppDebug()) ? console.log : false
            },
        }
    }
    /**
     * 输出格式化
     * @param ctx 
     */
    async outcheck(ctx: Context): Promise<any> {
        // if (!this.sendFile)
        return this.sendFile ? undefined : {
            d: this._ctx.body !== undefined ? this._ctx.body : '',
            c: this._ctx.error ? (ctx.status != 200 ? ctx.status : 500) : 200,
            i: this._ctx.control ? [this._ctx.control.Module, this._ctx.control.Controller, this._ctx.control.Method].join('/') : '',
            e: this._ctx.error ? {
                m: this._ctx.error.message ? this._ctx.error.message : this._ctx.error
            } : ''
        }
    }
    /**
     * 获取Sequence数据库实例
     */
    async getSequelizeDb(): Promise<Sequelize.Sequelize> {
        let config = await this.getDbConfig();
        let hash = MD5.encode(JSON.stringify(config));
        if (!SequelizeDBs[hash]) {
            if (config.options && config.options.dialect == 'tablestore') {
                SequelizeDBs[hash] = new (require('@ctsy/aliyun-tablestore').default)(config.database, config.username, config.password, config.options)
            } else {
                SequelizeDBs[hash] = new Sequelize.Sequelize(config.database, config.username, config.password, config.options);
            }
        }
        return SequelizeDBs[hash];
    }
    /**
     * 事务标识
     */
    protected _trans?: Sequelize.Transaction;

    get transaction() {
        return this._trans;
    }
    get transactionTimes() {
        return this._transTimes;
    }
    /**
     * 事务层数
     */
    public _transTimes: number = 0;
    /**
     * 开启事务
     */
    async startTrans(): Promise<Sequelize.Transaction> {
        this._transTimes++;
        if (this._trans) {
            return this._trans
        }
        return this._trans = await (await this.getSequelizeDb()).transaction();
    }
    /**
     * 提交事务
     */
    async commit(): Promise<boolean> {
        this._transTimes--
        hook.emit(ConfigHooks.COMMIT_TRANS, HookWhen.Before, this._ctx, this)
        if (this._trans && this._transTimes == 0) {
            await this._trans.commit()
            this._trans = undefined;
        }
        hook.emit(ConfigHooks.COMMIT_TRANS, HookWhen.After, this._ctx, this)
        return true;
    }
    /**
     * 事务撤销
     */
    async rollback(): Promise<boolean> {
        this._transTimes = 0
        hook.emit(ConfigHooks.ROLLBACK_TRANS, HookWhen.Before, this._ctx, this)
        if (this._trans) {
            await this._trans.rollback()
            this._trans == undefined;
        }
        hook.emit(ConfigHooks.ROLLBACK_TRANS, HookWhen.After, this._ctx, this)
        return true;
    }
    /**
     * 获取数据库结构定义文件
     * @param TableName 
     */
    getDbDefine(TableName: string) {
        //加载文件
        let libs = this.getLibPath(true);
        if (libs instanceof Array) {
            for (let x of libs) {
                try {
                    let d = require(resolve(join(x, 'db', TableName)))
                    return d.default
                } catch (e) {
                }
            }
            throw new Error(`DB_DEFINE_NOT_FOUND:${TableName}`)
        } else {
            try {
                let d = require(resolve(join(libs, 'db', TableName)))
                return d.default
            } catch (e) {
                throw new Error(`DB_DEFINE_NOT_FOUND:${TableName}`)
            }
        }
    }
    /**
     * 获取数据库的主键
     * @param TableName 
     */
    getDbTablePK(TableName: string) {
        let define = this.getDbDefine(TableName);
        let keys = Object.keys(define);
        for (let i = 0; i < keys.length; i++) {
            if (define[keys[i]].primaryKey) { return keys[i]; }
        }
        throw new Error(`NO_PK:${TableName}`)
    }
    getDbTableFields(TableName: string): Promise<{ [index: string]: { type: any, [index: string]: any } }> {
        return this.getDbDefine(TableName)
    }
    /**
     * 是否允许CORS跨域
     */
    async allowCORS(): Promise<boolean> {
        return true;
    }
    /**
     * 转发配置
     */
    async getProxy(): Promise<{ Host: string, Options: any } | any> {
        return false;
    }
    /**
     * 动态缓存目录
     */
    Dynamic: string[] = []
    /**
     * 模块映射关系
     */
    ModulesMap: { [index: string]: string } = {

    }
    /**
     * 生成控制器规则
     */
    async getController(): Promise<RouterPath> {
        let r = new RouterPath
        if (this._ctx && this._ctx.path) {
            let p = this._ctx.path.split('/');
            if (this._ctx.method == "GET" && extname(this._ctx.path) && !this.Dynamic.includes(p[0])) {
                this.sendFile = true;
            }
            if (p.length > 1) {
                if (p[0] == "" && p.length > 2) { p.shift() }
                if (p[0] == 'api') { p.shift() }
                if (p[0].startsWith('_')) {
                    //模块模式
                    let mname = p[0].substr(1);
                    r.Controller = p[1];
                    r.Method = p[2] || 'index';
                    r.Path = this.ModulesMap[mname];
                    r.Module = mname;
                } else {
                    r.Controller = p[0];
                    r.Method = p[1] || 'index';
                }
            }
        }
        return this._ctx.route = r
    }
    /**
     * 静态文件处理
     */
    async getStaticFile() {
        return await send(this._ctx, this._ctx.path, {
            root: await this.getStaticPath(),
            index: 'index.html',
            maxage: 86400000,
        })
    }
}
/**
 * 路径类
 */
export class RouterPath {
    Module: string = '';
    Method: string = "";
    Controller: string = "";
    _path: string = "";
    get Path() {
        return this._path
    }
    set Path(v: string) {
        this._path = v;
        this.Paths.push(v);
    }
    Paths: string[] = []
}
/**
 * 配置Hook钩子
 */
export enum ConfigHooks {
    NEW_CONFIG = 'NEW_CONFIG',
    START_TRANS = 'START_TRANS',
    COMMIT_TRANS = 'COMMIT_TRANS',
    ROLLBACK_TRANS = 'ROLLBACK_TRANS',
}