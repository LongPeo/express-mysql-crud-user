import i18n from 'i18n';
import { ErrorCodes } from '../../helpers/constants';
import {
    hashPassword,
    isValidPassword,
    saveToken,
    checkIfTokenExist,
    destroyToken,
    signToken,
    userAuthInfo,
} from './authService';
import { getUserDetail } from '../users/userService';
import {
    respondWithError,
    logSystemError,
    respondSuccess,
} from '../../helpers/messageResponse';

const models = require('../../models');

export async function register(req, res) {
    try {
        const { email, password } = req.body;
        let user = await models.User.findOne({
            where: {
                email,
            },
        });
        if (user) {
            return res
                .status(ErrorCodes.ERROR_CODE_EMAIL_EXIST)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_EMAIL_EXIST,
                        i18n.__('auth.login.emailExist'),
                        {},
                    ),
                );
        }
        const savePass = hashPassword(password);
        user = await models.User.create({ email, password: savePass });
        const { token, rToken } = await signToken(user);
        await saveToken(user, rToken);
        return res.json(respondSuccess(userAuthInfo(user, token, rToken)));
    } catch (error) {
        return logSystemError(res, error, 'authController - register');
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await models.User.findOne({
            attributes: [
                'id',
                'email',
                'fullName',
                'birthday',
                'phone',
                'password',
            ],
            where: {
                email,
            },
        });
        if (!user) {
            // return user not exist
            return res
                .status(ErrorCodes.ERROR_CODE_INVALID_USERNAME_OR_PASSWORD)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_INVALID_USERNAME_OR_PASSWORD,
                        i18n.__('auth.login.wrongEmailOrPassword'),
                        {},
                    ),
                );
        }
        if (!isValidPassword(user.password, password)) {
            // return password not correct
            return res
                .status(ErrorCodes.ERROR_CODE_INVALID_USERNAME_OR_PASSWORD)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_INVALID_USERNAME_OR_PASSWORD,
                        i18n.__('auth.login.wrongEmailOrPassword'),
                        {},
                    ),
                );
        }
        const { token, rToken } = await signToken(user);
        await saveToken(user, rToken);
        // return data
        return res.json(respondSuccess(userAuthInfo(user, token, rToken)));
    } catch (error) {
        return logSystemError(res, error, 'authController - login');
    }
}

export async function refreshToken(req, res) {
    try {
        const { loginUser = {}, refreshToken: oldRefreshToken = null } = req;
        const user = await getUserDetail(loginUser.id);
        if (!user) {
            return res
                .status(ErrorCodes.ERROR_CODE_UNAUTHORIZED)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_UNAUTHORIZED,
                        'Unauthorized',
                    ),
                );
        }
        const isTokenExit = await checkIfTokenExist(user, oldRefreshToken);
        if (!isTokenExit) {
            return res
                .status(ErrorCodes.ERROR_CODE_UNAUTHORIZED)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_UNAUTHORIZED,
                        'Unauthorized',
                    ),
                );
        }

        const { token, rToken, permissions } = await signToken(user);
        await Promise.all([
            destroyToken(isTokenExit.id),
            saveToken(user, rToken),
        ]);
        return res.json(
            respondSuccess(userAuthInfo(user, token, rToken, permissions)),
        );
    } catch (error) {
        return logSystemError(res, error, 'authController - refreshToken');
    }
}

export async function getProfile(req, res) {
    try {
        const { loginUser = {} } = req;
        const user = await models.User.findByPk(loginUser.id, {
            attributes: ['id', 'email', 'fullName', 'gender', 'password'],
        });
        return res.json(
            respondSuccess({
                profile: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    gender: user.gender,
                },
            }),
        );
    } catch (error) {
        return logSystemError(res, error, 'authController - getProfile');
    }
}

export async function updateProfile(req, res) {
    try {
        const { loginUser = {} } = req;
        const { fullName, gender } = req.body;
        await models.User.update(
            {
                fullName,
                gender,
            },
            {
                where: {
                    id: loginUser.id,
                },
            },
        );
        const newProfile = await models.User.findByPk(loginUser.id, {
            attributes: ['id', 'email', 'fullName', 'gender'],
        });

        return res.json(
            respondSuccess({
                profile: {
                    newProfile,
                },
            }),
        );
    } catch (error) {
        return logSystemError(res, error, 'authController - updateProfile');
    }
}
export async function changePassword(req, res) {
    try {
        const { loginUser = {} } = req;
        const { oldPassword, newPassword } = req.body;
        const currentUser = await models.User.findByPk(loginUser.id);
        if (!isValidPassword(currentUser.password, oldPassword)) {
            return res
                .status(ErrorCodes.ERROR_CODE_OLD_PASSWORD_NOT_CORRECT)
                .json(
                    respondWithError(
                        ErrorCodes.ERROR_CODE_OLD_PASSWORD_NOT_CORRECT,
                        i18n.__('auth.login.oldPasswordIsNotCorrect'),
                        {},
                    ),
                );
        }
        await models.User.update(
            {
                password: hashPassword(newPassword),
            },
            {
                where: {
                    id: loginUser.id,
                },
            },
        );
        return res.json(respondSuccess());
    } catch (error) {
        return logSystemError(res, error, 'authController - changePassword');
    }
}
